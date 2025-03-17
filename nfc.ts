import {
	NfcPlugin,
	IsEnabledResult,
	NfcStatusChangedEvent,
	StartScanSessionOptions,
	TagDetectedEvent,
	WriteOptions,
	ShareOptions,
	PluginListenerHandle,
	NfcErrorType,
} from "./definitions.js";
import { WebNfc } from "./web.js";
import { IosBridgeNfc } from "./ios-bridge.js";
import { AndroidBridgeNfc } from "./android-bridge.js";
import { IosDetection } from "./ios-detection.js";
import { AndroidDetection } from "./android-detection.js";

/**
 * Main NFC class that provides access to NFC functionality.
 * It automatically chooses the appropriate implementation for the current platform.
 */
export class Nfc {
	private implementation: NfcPlugin;
	private listeners: Map<string, Set<Function>> = new Map();
	private iosInfo: any;
	private androidInfo: any;

	constructor() {
		this.iosInfo = IosDetection.getIosSupportInfo();
		this.androidInfo = AndroidDetection.getAndroidSupportInfo();

		// Choose the appropriate implementation based on platform detection
		if (
			this.iosInfo.isIos &&
			typeof (window as any).nativeNfcBridge !== "undefined"
		) {
			console.log("Using iOS Native Bridge for NFC");
			this.implementation = new IosBridgeNfc();
		} else if (this.androidInfo.isAndroid && this.androidInfo.useNativeBridge) {
			console.log("Using Android Native Bridge for NFC");
			this.implementation = new AndroidBridgeNfc();
		} else {
			// Fall back to Web NFC for supported browsers
			console.log("Using Web NFC implementation");
			this.implementation = new WebNfc();
		}

		// Set up status monitoring to track NFC availability
		this.monitorNfcStatus();
	}

	/**
	 * Internal method to monitor NFC status changes
	 */
	private async monitorNfcStatus(): Promise<void> {
		try {
			// Set up listener for NFC status changes from implementation
			await this.implementation.addListener("nfcStatusChanged", (status) => {
				// Propagate to our own listeners
				this.notifyListeners("nfcStatusChanged", status);
			});
		} catch (error) {
			console.warn("Failed to set up NFC status monitoring:", error);
		}
	}

	/**
	 * Check if NFC is enabled (Android) or available (iOS/Web).
	 * @returns Promise resolving to an object with an `enabled` boolean property
	 */
	public async isEnabled(): Promise<IsEnabledResult> {
		try {
			return await this.implementation.isEnabled();
		} catch (error) {
			console.error("Error checking NFC status:", error);
			return { enabled: false };
		}
	}

	/**
	 * Open NFC settings (Android) or app settings (iOS) or shows guidance (Web).
	 * This helps users enable NFC if it's disabled.
	 */
	public async openSettings(): Promise<void> {
		return this.implementation.openSettings();
	}

	/**
	 * Start scanning for NFC tags.
	 * @param options Configuration options for the scan session
	 */
	public async startScanSession(
		options?: StartScanSessionOptions
	): Promise<void> {
		try {
			return await this.implementation.startScanSession(options);
		} catch (error: any) {
			// Convert to a standardized error object if possible
			const nfcError: any = new Error(
				error.message || "Failed to start NFC scan"
			);

			if (
				error.message?.includes("not supported") ||
				error.name === "NotSupportedError"
			) {
				nfcError.code = NfcErrorType.NOT_SUPPORTED;
			} else if (
				error.message?.includes("permission") ||
				error.name === "NotAllowedError"
			) {
				nfcError.code = NfcErrorType.PERMISSION_DENIED;
			} else if (error.message?.includes("not enabled")) {
				nfcError.code = NfcErrorType.NOT_ENABLED;
			} else {
				nfcError.code = NfcErrorType.UNEXPECTED_ERROR;
			}

			throw nfcError;
		}
	}

	/**
	 * Stop the current NFC scan session.
	 */
	public async stopScanSession(): Promise<void> {
		return this.implementation.stopScanSession();
	}

	/**
	 * Write an NDEF message to an NFC tag.
	 * @param options Object containing the NDEF message to write
	 */
	public async write(options: WriteOptions): Promise<void> {
		return this.implementation.write(options);
	}

	/**
	 * Make an NFC tag read-only.
	 * WARNING: This is a permanent operation that cannot be undone.
	 */
	public async makeReadOnly(): Promise<void> {
		return this.implementation.makeReadOnly();
	}

	/**
	 * Format an NFC tag, erasing its contents and preparing it for writing.
	 */
	public async format(): Promise<void> {
		return this.implementation.format();
	}

	/**
	 * Erase the contents of an NFC tag.
	 */
	public async erase(): Promise<void> {
		return this.implementation.erase();
	}

	/**
	 * Share NDEF data via NFC (Android only, not available on iOS or Web).
	 * @param options Object containing the NDEF message to share
	 */
	public async share(options: ShareOptions): Promise<void> {
		return this.implementation.share(options);
	}

	/**
	 * Stop sharing NDEF data via NFC (Android only).
	 */
	public async stopSharing(): Promise<void> {
		return this.implementation.stopSharing();
	}

	/**
	 * Register an event listener.
	 * @param eventName Name of the event to listen for
	 * @param listenerFunc Callback function to invoke when the event occurs
	 * @returns A handle that can be used to remove the listener
	 */
	public async addListener(
		eventName: "nfcStatusChanged",
		listenerFunc: (status: NfcStatusChangedEvent) => void
	): Promise<PluginListenerHandle>;
	public async addListener(
		eventName: "tagDetected",
		listenerFunc: (tag: TagDetectedEvent) => void
	): Promise<PluginListenerHandle>;
	public async addListener(
		eventName: string,
		listenerFunc: (data: any) => void
	): Promise<PluginListenerHandle> {
		// Add to our internal listener registry
		if (!this.listeners.has(eventName)) {
			this.listeners.set(eventName, new Set());
		}
		this.listeners.get(eventName)?.add(listenerFunc);

		// Register with the implementation
		const handle = await this.implementation.addListener(
			eventName as "nfcStatusChanged" | "tagDetected" as any,
			listenerFunc
		);

		// Return a handle that will clean up properly
		return {
			remove: async () => {
				this.listeners.get(eventName)?.delete(listenerFunc);
				return handle.remove();
			},
		};
	}

	/**
	 * Remove all event listeners registered for this plugin.
	 */
	public async removeAllListeners(): Promise<void> {
		// Clear our internal listener registry
		this.listeners.clear();

		// Remove listeners from the implementation
		return this.implementation.removeAllListeners();
	}

	/**
	 * Internal method to notify listeners of events
	 */
	private notifyListeners(eventName: string, data: any): void {
		const listeners = this.listeners.get(eventName);
		if (listeners) {
			for (const listener of listeners) {
				try {
					listener(data);
				} catch (error) {
					console.error(`Error in ${eventName} listener:`, error);
				}
			}
		}
	}
}
