import {
	NfcPlugin,
	IsEnabledResult,
	StartScanSessionOptions,
	WriteOptions,
	ShareOptions,
	PluginListenerHandle,
	TagDetectedEvent,
	NfcErrorType,
	NdefRecord,
} from './definitions.js';
import { IosDetection } from './ios-detection.js';

export class WebNfc implements NfcPlugin {
	private scanSessionActive = false;
	private scanOnce = false;
	private listeners: { [key: string]: Array<(...args: any[]) => void> } = {};
	private ndefReader: any = null;
	private nfcSupported: boolean = false;
	private iosInfo: any = null;

	constructor() {
		this.detectNfcSupport();
	}


	private detectNfcSupport() {
		// Check for iOS first
		this.iosInfo = IosDetection.getIosSupportInfo();

		if (this.iosInfo.isIos) {
			this.nfcSupported = false;
			console.info('iOS device detected:', this.iosInfo);

			if (this.iosInfo.supportsNfc) {
				console.warn('iOS NFC requires a native app wrapper - web browser access is not supported');
			} else {
				console.warn('NFC is not supported on this iOS device or iOS version');
			}
			return;
		}

		// Check Web NFC API for other platforms (primarily Android)
		if (typeof window !== 'undefined') {
			this.nfcSupported = 'NDEFReader' in window;

			const userAgent = navigator.userAgent;
			const isHttps = window.location.protocol === 'https:';
			const isPWA = window.matchMedia('(display-mode: standalone)').matches;

			console.info('NFC Support Check:', {
				supported: this.nfcSupported,
				isHttps: isHttps,
				isPWA: isPWA,
				isAndroid: /android/i.test(userAgent),
				isChrome: /chrome/i.test(userAgent)
			});

			if (!this.nfcSupported) {
				const reason = !isHttps ? 'NFC requires HTTPS' :
					!/android/i.test(userAgent) ? 'NFC Web API only supported on Android' :
						!/chrome/i.test(userAgent) ? 'NFC Web API only supported in Chrome-based browsers' :
							'This browser does not support the Web NFC API';

				console.warn(`Web NFC not available: ${reason}`);
			}
		} else {
			this.nfcSupported = false;
			console.warn('Web NFC not available: Not in browser environment');
		}
	}

	async isEnabled(): Promise<IsEnabledResult> {
		// For iOS, provide accurate info without throwing errors
		if (this.iosInfo?.isIos) {
			return { enabled: false };
		}

		return { enabled: this.nfcSupported };
	}

	async openSettings(): Promise<void> {
		// Special handling for iOS
		if (this.iosInfo?.isIos) {
			const message = IosDetection.getIosNfcGuidance();

			// Use alert() on iOS to show guidance
			if (typeof alert === 'function') {
				alert(message);
			}

			console.warn('iOS NFC guidance:', message);
			return;
		}

		if (!this.nfcSupported) {
			throw this.createCompatibilityError();
		}

		console.warn('openSettings: On web, users must enable NFC in device settings manually.');

		// Provide instructions based on browser detection
		if (/android/i.test(navigator.userAgent)) {
			alert('Please enable NFC in your device settings: Settings > Connected devices > Connection preferences > NFC');
		} else {
			alert('Please ensure NFC is enabled on your device.');
		}
	}


	async startScanSession(options?: StartScanSessionOptions): Promise<void> {

		if (this.iosInfo?.isIos) {
			throw new Error("NFC reading is not supported in web browsers on iOS. " +
				"To use NFC on iOS, you need a native app implementation.");
		}

		if (!this.nfcSupported) {
			throw this.createCompatibilityError();
		}

		this.scanSessionActive = true;
		this.scanOnce = options?.once ?? false;

		try {
			// Create and configure the NDEF reader
			this.ndefReader = new (window as any).NDEFReader();

			// Set up event listeners
			this.ndefReader.addEventListener("reading", (event: any) => {
				if (!this.scanSessionActive) return;

				try {
					const tag = this.parseNdefReading(event);

					// Notify listeners
					const tagListeners = this.listeners["tagDetected"] || [];
					for (const listener of tagListeners) {
						listener(tag);
					}

					// If scanOnce is true, stop scanning after first detection
					if (this.scanOnce) {
						this.stopScanSession();
					}
				} catch (error) {
					console.error("Error processing NFC tag:", error);
				}
			});

			this.ndefReader.addEventListener("error", (error: any) => {
				console.error(`NFC Error: ${error.message || error}`);
			});

			// Start scanning - might throw if user denies permission
			await this.ndefReader.scan();
			console.log("NFC scan started successfully");
		} catch (error: any) {
			this.scanSessionActive = false;

			// Provide user-friendly error message
			if (error.name === "NotAllowedError") {
				console.error("NFC permission denied by user");
				throw new Error(
					"NFC permission denied. Please allow NFC scanning when prompted."
				);
			} else if (error.name === "NotSupportedError") {
				console.error("NFC not supported on this device/browser");
				throw new Error("NFC is not supported on this device or browser.");
			} else {
				console.error("Error starting NFC scan:", error);
				throw new Error(
					`Failed to start NFC scan: ${error.message || "Unknown error"}`
				);
			}
		}
	}

	private parseNdefReading(event: any): TagDetectedEvent {
		const serialNumber = event.serialNumber || "";
		const messages: { records: NdefRecord[] }[] = [];

		if (event.message) {
			const records: NdefRecord[] = [];

			// Parse each NDEF record
			for (const record of event.message.records) {
				const recordType = record.recordType;
				let payload = "";
				let text = "";
				let uri = "";

				// Handle different record types
				if (record.data) {
					const decoder = new TextDecoder();

					if (recordType === "text") {
						// Text record
						text = decoder.decode(record.data);
						payload = text;
					} else if (recordType === "url") {
						// URL record
						uri = decoder.decode(record.data);
						payload = uri;
					} else {
						// Other record types - try to decode as text
						try {
							payload = decoder.decode(record.data);
						} catch (e) {
							// If text decoding fails, get hex representation
							payload = Array.from(new Uint8Array(record.data))
								.map((b) => b.toString(16).padStart(2, "0"))
								.join("");
						}
					}
				}

				// Create record in our format
				records.push({
					id: "",
					tnf: this.mapRecordTypeToTnf(recordType),
					type: recordType || "",
					payload,
					languageCode: record.lang || "en",
					text,
					uri,
				});
			}

			if (records.length > 0) {
				messages.push({ records });
			}
		}

		return {
			id: serialNumber,
			techTypes: ["ndef"], // Web NFC only exposes NDEF
			messages,
		};
	}

	private mapRecordTypeToTnf(recordType: string): number {
		// Map Web NFC record types to TNF values
		if (!recordType) return 0; // EMPTY
		if (recordType === "text" || recordType === "url") return 1; // WELL_KNOWN
		if (recordType.includes("/")) return 2; // MIME_MEDIA
		if (recordType.startsWith("urn:")) return 3; // ABSOLUTE_URI
		return 4; // EXTERNAL_TYPE (default)
	}

	async stopScanSession(): Promise<void> {
		this.scanSessionActive = false;

		if (this.ndefReader) {
			try {
				// While Web NFC doesn't have explicit stop method, we can
				// use AbortController in newer implementations
				if (this.ndefReader.abort) {
					this.ndefReader.abort();
				}
				console.log("NFC scan stopped");
			} catch (error) {
				console.warn("Error stopping NFC scan:", error);
			}
		}
	}

	async write(options: WriteOptions): Promise<void> {
		if (!this.nfcSupported) {
			throw this.createCompatibilityError();
		}

		try {
			const writer = new (window as any).NDEFReader();

			// Convert our message format to Web NFC format
			const records = options.message.records.map((record) => {
				const recordOptions: any = {};

				// Handle different record types
				if (record.type === "T") {
					recordOptions.recordType = "text";
					recordOptions.data = record.payload || record.text || "";
					if (record.languageCode) {
						recordOptions.lang = record.languageCode;
					}
				} else if (record.type === "U") {
					recordOptions.recordType = "url";
					recordOptions.data = record.payload || record.uri || "";
				} else {
					// For other types
					recordOptions.recordType = record.type;
					recordOptions.data = record.payload || "";
				}

				return recordOptions;
			});

			// Write the records
			await writer.write({ records });
			console.log("NFC write successful");
		} catch (error: any) {
			if (error.name === "NotAllowedError") {
				throw new Error(
					"NFC write permission denied. Please allow when prompted."
				);
			} else if (error.name === "NotSupportedError") {
				throw new Error(
					"NFC write is not supported on this device or browser."
				);
			} else {
				console.error("Error writing to NFC tag:", error);
				throw new Error(
					`Failed to write to NFC tag: ${error.message || "Unknown error"}`
				);
			}
		}
	}

	async makeReadOnly(): Promise<void> {
		if (!this.nfcSupported) {
			throw this.createCompatibilityError();
		}

		throw new Error("makeReadOnly is not supported in the Web NFC API");
	}

	async format(): Promise<void> {
		if (!this.nfcSupported) {
			throw this.createCompatibilityError();
		}

		// To "format" in Web NFC, write an empty NDEF message
		try {
			const writer = new (window as any).NDEFReader();
			await writer.write({ records: [] });
			console.log("NFC tag formatted (wrote empty NDEF message)");
		} catch (error: any) {
			console.error("Error formatting NFC tag:", error);
			throw new Error(
				`Failed to format NFC tag: ${error.message || "Unknown error"}`
			);
		}
	}

	async erase(): Promise<void> {
		// Same implementation as format for Web NFC
		return this.format();
	}

	async share(options: ShareOptions): Promise<void> {
		if (!this.nfcSupported) {
			throw this.createCompatibilityError();
		}

		throw new Error("NFC sharing is not supported in the Web NFC API");
	}

	async stopSharing(): Promise<void> {
		if (!this.nfcSupported) {
			throw this.createCompatibilityError();
		}

		throw new Error("NFC sharing is not supported in the Web NFC API");
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

	private createCompatibilityError(): Error {
		if (this.iosInfo?.isIos) {
			return new Error("iOS browsers don't support the Web NFC API. To use NFC on iOS, you need a native app implementation.");
		}

		return new Error('Web NFC API is not supported in this browser. NFC Web API requires Chrome 89+ on Android with NFC hardware, running over HTTPS.');
	}
}
