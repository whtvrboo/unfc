// src/android-bridge.ts
import {
	NfcPlugin,
	IsEnabledResult,
	TagDetectedEvent,
	NfcStatusChangedEvent,
	StartScanSessionOptions,
	WriteOptions,
	ShareOptions,
	PluginListenerHandle,
	NfcErrorType,
} from "./definitions.js";

/**
 * Interface for native Android app to implement for WebView communication
 */
interface NativeAndroidBridge {
	isNfcEnabled?: () => Promise<boolean>;
	startNfcScan?: (options: string) => Promise<void>;
	stopNfcScan?: () => Promise<void>;
	writeNfcTag?: (data: string) => Promise<void>;
	makeNfcTagReadOnly?: () => Promise<void>;
	formatNfcTag?: () => Promise<void>;
	eraseNfcTag?: () => Promise<void>;
	shareNfcData?: (data: string) => Promise<void>;
	stopNfcSharing?: () => Promise<void>;
	openNfcSettings?: () => Promise<void>;
}

/**
 * NFC implementation that communicates with a native Android app via a bridge
 * This provides better integration with Capacitor Android projects
 */
export class AndroidBridgeNfc implements NfcPlugin {
	private bridge: NativeAndroidBridge;
	private listeners: { [key: string]: Array<(...args: any[]) => void> } = {};
	private isBridgeAvailable: boolean = false;

	constructor() {
		// Look for the bridge in the global scope
		// The native app needs to inject this object
		this.bridge = (window as any).nativeAndroidNfcBridge || {};
		this.isBridgeAvailable = !!(
			this.bridge.isNfcEnabled && this.bridge.startNfcScan
		);

		// Set up message listener for tag detection events from native app
		if (this.isBridgeAvailable) {
			window.addEventListener("message", this.handleNativeMessage.bind(this));
			console.log("Android NFC bridge initialized");
		} else {
			console.warn("Android NFC bridge not found");
		}
	}

	private handleNativeMessage(event: MessageEvent) {
		if (!event.data || typeof event.data !== "object") return;

		// Handle tag detected message from native app
		if (event.data.type === "nfcTagDetected" && event.data.tag) {
			const tagListeners = this.listeners["tagDetected"] || [];
			const tag = event.data.tag as TagDetectedEvent;

			for (const listener of tagListeners) {
				listener(tag);
			}
		}

		// Handle NFC status change from native app
		if (
			event.data.type === "nfcStatusChanged" &&
			event.data.enabled !== undefined
		) {
			const statusListeners = this.listeners["nfcStatusChanged"] || [];

			for (const listener of statusListeners) {
				listener({ enabled: !!event.data.enabled });
			}
		}
	}

	async isEnabled(): Promise<IsEnabledResult> {
		if (!this.isBridgeAvailable) {
			return { enabled: false };
		}

		try {
			const enabled = await this.bridge.isNfcEnabled!();
			return { enabled };
		} catch (error) {
			console.error("Error checking NFC status through bridge:", error);
			return { enabled: false };
		}
	}

	async openSettings(): Promise<void> {
		if (!this.isBridgeAvailable || !this.bridge.openNfcSettings) {
			throw new Error("NFC settings cannot be opened - bridge not available");
		}

		try {
			await this.bridge.openNfcSettings();
		} catch (error) {
			console.error("Error opening NFC settings through bridge:", error);
			throw error;
		}
	}

	async startScanSession(options?: StartScanSessionOptions): Promise<void> {
		if (!this.isBridgeAvailable) {
			throw new Error("NFC scan cannot be started - bridge not available");
		}

		try {
			await this.bridge.startNfcScan!(JSON.stringify(options || {}));
		} catch (error) {
			console.error("Error starting NFC scan through bridge:", error);
			throw error;
		}
	}

	async stopScanSession(): Promise<void> {
		if (!this.isBridgeAvailable || !this.bridge.stopNfcScan) {
			return; // Just silently return if bridge not available
		}

		try {
			await this.bridge.stopNfcScan!();
		} catch (error) {
			console.error("Error stopping NFC scan through bridge:", error);
		}
	}

	async write(options: WriteOptions): Promise<void> {
		if (!this.isBridgeAvailable || !this.bridge.writeNfcTag) {
			throw new Error("NFC write is not supported - bridge not available");
		}

		try {
			await this.bridge.writeNfcTag!(JSON.stringify(options));
		} catch (error) {
			console.error("Error writing NFC tag through bridge:", error);
			throw error;
		}
	}

	async makeReadOnly(): Promise<void> {
		if (!this.isBridgeAvailable || !this.bridge.makeNfcTagReadOnly) {
			throw new Error("makeReadOnly is not implemented in the Android bridge");
		}

		try {
			await this.bridge.makeNfcTagReadOnly!();
		} catch (error) {
			console.error("Error making NFC tag read-only through bridge:", error);
			throw error;
		}
	}

	async format(): Promise<void> {
		if (!this.isBridgeAvailable || !this.bridge.formatNfcTag) {
			throw new Error("format is not implemented in the Android bridge");
		}

		try {
			await this.bridge.formatNfcTag!();
		} catch (error) {
			console.error("Error formatting NFC tag through bridge:", error);
			throw error;
		}
	}

	async erase(): Promise<void> {
		if (!this.isBridgeAvailable || !this.bridge.eraseNfcTag) {
			throw new Error("erase is not implemented in the Android bridge");
		}

		try {
			await this.bridge.eraseNfcTag!();
		} catch (error) {
			console.error("Error erasing NFC tag through bridge:", error);
			throw error;
		}
	}

	async share(options: ShareOptions): Promise<void> {
		if (!this.isBridgeAvailable || !this.bridge.shareNfcData) {
			throw new Error("share is not implemented in the Android bridge");
		}

		try {
			await this.bridge.shareNfcData!(JSON.stringify(options));
		} catch (error) {
			console.error("Error sharing NFC data through bridge:", error);
			throw error;
		}
	}

	async stopSharing(): Promise<void> {
		if (!this.isBridgeAvailable || !this.bridge.stopNfcSharing) {
			throw new Error("stopSharing is not implemented in the Android bridge");
		}

		try {
			await this.bridge.stopNfcSharing!();
		} catch (error) {
			console.error("Error stopping NFC sharing through bridge:", error);
			throw error;
		}
	}

	async addListener(
		eventName: "nfcStatusChanged" | "tagDetected",
		listenerFunc: (data: any) => void
	): Promise<PluginListenerHandle> {
		if (!this.listeners[eventName]) {
			this.listeners[eventName] = [];
		}

		this.listeners[eventName].push(listenerFunc);

		return {
			remove: async () => {
				this.removeListener(eventName, listenerFunc);
			},
		};
	}

	private removeListener(
		eventName: string,
		listenerFunc: (data: any) => void
	): void {
		if (this.listeners[eventName]) {
			this.listeners[eventName] = this.listeners[eventName].filter(
				(listener) => listener !== listenerFunc
			);
		}
	}

	async removeAllListeners(): Promise<void> {
		this.listeners = {};
	}
}
