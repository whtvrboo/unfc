import { Nfc } from "./nfc.js";
import { NfcUtils } from "./utils.js";
import { NFCDefinition } from "./definitions.js";

/**
 * A simplified API for common NFC reading operations
 */
export class SimpleNfc {
	private nfc: Nfc;
	private scanCallback: ((text: string, type: string) => void) | null = null;

	constructor() {
		this.nfc = new Nfc();
	}

	/**
	 * Check if NFC is available on this device/browser
	 */
	async isAvailable(): Promise<boolean> {
		try {
			const result = await this.nfc.isEnabled();
			return result.enabled;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Start scanning for NFC tags with a simplified callback
	 * The callback will receive text content and content type ('text', 'url', or 'other')
	 */
	async startReading(
		callback: (content: string, type: string) => void
	): Promise<void> {
		this.scanCallback = callback;

		// Set up the tag detection listener
		await this.nfc.addListener("tagDetected", (tag) => {
			// Try to get URL first
			const url = NfcUtils.getUrlFromTag(tag);
			if (url) {
				this.scanCallback?.(url, "url");
				return;
			}

			// Then try to get text
			const text = NfcUtils.getTextFromTag(tag);
			if (text) {
				this.scanCallback?.(text, "text");
				return;
			}

			// If we got here, we have other content
			if (tag.messages.length > 0 && tag.messages[0].records.length > 0) {
				const firstRecord = tag.messages[0].records[0];
				this.scanCallback?.(firstRecord.payload || "Unknown content", "other");
			} else {
				this.scanCallback?.("Empty tag", "other");
			}
		});

		// Start the actual scan
		await this.nfc.startScanSession();
	}

	/**
	 * Stop scanning for NFC tags
	 */
	async stopReading(): Promise<void> {
		this.scanCallback = null;
		await this.nfc.stopScanSession();
		await this.nfc.removeAllListeners();
	}

	/**
	 * Write a simple text to an NFC tag
	 */
	async writeText(text: string): Promise<void> {
		const textRecord = NfcUtils.createTextRecord(text);
		await this.nfc.write({
			message: {
				records: [textRecord],
			},
		});
	}

	/**
	 * Write a URL to an NFC tag
	 */
	async writeUrl(url: string): Promise<void> {
		const urlRecord = NfcUtils.createUriRecord(url);
		await this.nfc.write({
			message: {
				records: [urlRecord],
			},
		});
	}

	/**
	 * Read a simple NFC tag
	 */
	read(): NFCDefinition {
		// Dummy implementation
		return { id: "2", data: "simple data" };
	}
}
