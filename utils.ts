// src/utils.ts
import { NdefRecord, NdefMessage, NfcTnf, NfcRtd } from "./definitions.js";

export class NfcUtils {
	/**
	 * Creates a simple text record
	 */
	static createTextRecord(
		text: string,
		languageCode: string = "en"
	): NdefRecord {
		return {
			id: "",
			tnf: NfcTnf.WELL_KNOWN,
			type: NfcRtd.TEXT,
			payload: text,
			languageCode,
			text,
		};
	}

	/**
	 * Creates a URI/URL record
	 */
	static createUriRecord(uri: string): NdefRecord {
		return {
			id: "",
			tnf: NfcTnf.WELL_KNOWN,
			type: NfcRtd.URI,
			payload: uri,
			uri,
		};
	}

	/**
	 * Creates a complete NDEF message with one or more records
	 */
	static createMessage(records: NdefRecord[]): NdefMessage {
		return { records };
	}

	/**
	 * Extract text content from detected tag
	 * Returns the first text record found or null if none
	 */
	static getTextFromTag(tag: { messages: NdefMessage[] }): string | null {
		for (const message of tag.messages) {
			for (const record of message.records) {
				// First check the text field
				if (record.text) {
					return record.text;
				}
				// Then check for text record type
				if ((record.type === "T" || record.type === "text") && record.payload) {
					return record.payload;
				}
			}
		}
		return null;
	}

	/**
	 * Extract URL/URI from detected tag
	 * Returns the first URL record found or null if none
	 */
	static getUrlFromTag(tag: { messages: NdefMessage[] }): string | null {
		for (const message of tag.messages) {
			for (const record of message.records) {
				// First check uri field
				if (record.uri) {
					return record.uri;
				}
				// Then check for URI record type
				if ((record.type === "U" || record.type === "url") && record.payload) {
					return record.payload;
				}
			}
		}
		return null;
	}

	/**
	 * Checks if this browser environment supports Web NFC
	 */
	static isWebNfcSupported(): boolean {
		return typeof window !== "undefined" && "NDEFReader" in window;
	}

	/**
	 * Checks if the device is likely to have NFC hardware
	 * (Not 100% reliable but useful as a hint)
	 */
	static isNfcLikelyAvailable(): boolean {
		const ua = navigator.userAgent;
		// Most Android devices have NFC these days
		if (/android/i.test(ua)) return true;
		// iOS detection is tricky as Web NFC isn't available anyway
		return false;
	}
}

export function formatData(data: string): string {
	// Implement your utility function here
	return data.trim();
}
