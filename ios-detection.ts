export interface IosSupportInfo {
	isIos: boolean;
	version: number | null;
	supportsNfc: boolean;
	requiresNative: boolean;
}

/**
 * Provides detailed information about iOS NFC compatibility
 */
export class IosDetection {
	/**
	 * Detects if the current device is running iOS and its NFC capabilities
	 */
	static getIosSupportInfo(): IosSupportInfo {
		const userAgent = navigator.userAgent;

		// Detect iOS
		const isIos = /iphone|ipad|ipod/i.test(userAgent);
		if (!isIos) {
			return {
				isIos: false,
				version: null,
				supportsNfc: false,
				requiresNative: false,
			};
		}

		// Extract iOS version
		const versionMatch = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
		const version = versionMatch
			? parseInt(versionMatch[1], 10) + parseInt(versionMatch[2], 10) / 10
			: null;

		// iOS NFC support info:
		// - iOS 11+ supports NFC reading but requires a native app
		// - No iOS version supports Web NFC API
		const supportsNfc = version !== null && version >= 11;

		return {
			isIos,
			version,
			supportsNfc,
			requiresNative: true, // iOS always requires native app for NFC
		};
	}

	/**
	 * Checks if this device supports NFC in any form (native or web)
	 */
	static hasNfcHardware(): boolean {
		const iosInfo = this.getIosSupportInfo();
		if (iosInfo.isIos) {
			return iosInfo.supportsNfc;
		}

		// For Android/other platforms, we check based on the user agent
		return /android/i.test(navigator.userAgent);
	}

	/**
	 * Provides guidance for enabling NFC on iOS
	 */
	static getIosNfcGuidance(): string {
		const iosInfo = this.getIosSupportInfo();

		if (!iosInfo.isIos) {
			return "";
		}

		if (!iosInfo.supportsNfc) {
			return "Your iOS device does not support NFC or is running an iOS version below 11.0.";
		}

		return "NFC on iOS requires a native app. The web browser cannot directly access NFC hardware on iOS devices.";
	}
}
