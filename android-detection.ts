export interface AndroidSupportInfo {
	isAndroid: boolean;
	version: number | null;
	supportsNfc: boolean;
	supportsWebNfc: boolean;
}

/**
 * Provides detailed information about Android NFC compatibility
 */
export class AndroidDetection {
	/**
	 * Detects if the current device is running Android and its NFC capabilities
	 */
	static getAndroidSupportInfo(): AndroidSupportInfo {
		const userAgent = navigator.userAgent;

		// Detect Android
		const isAndroid = /android/i.test(userAgent);
		if (!isAndroid) {
			return {
				isAndroid: false,
				version: null,
				supportsNfc: false,
				supportsWebNfc: false,
			};
		}

		// Extract Android version
		const versionMatch = userAgent.match(/Android (\d+)(?:\.(\d+))?/);
		const version = versionMatch
			? parseInt(versionMatch[1], 10) +
			  parseInt(versionMatch[2] || "0", 10) / 10
			: null;

		// Android NFC support info:
		// - Android 4.0+ supports NFC through native APIs
		// - Android with Chrome 89+ supports Web NFC API
		const supportsNfc = version !== null && version >= 4.0;
		const isChrome = /chrome|chromium/i.test(userAgent);
		const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
		const chromeVersion = chromeMatch ? parseInt(chromeMatch[1], 10) : 0;

		// Chrome 89+ supports Web NFC API on Android
		const supportsWebNfc = isChrome && chromeVersion >= 89;

		return {
			isAndroid,
			version,
			supportsNfc,
			supportsWebNfc,
		};
	}

	/**
	 * Checks if this Android device likely supports NFC through native APIs
	 */
	static hasNativeNfcSupport(): boolean {
		const androidInfo = this.getAndroidSupportInfo();
		return androidInfo.isAndroid && androidInfo.supportsNfc;
	}

	/**
	 * Checks if this Android device supports Web NFC API
	 */
	static hasWebNfcSupport(): boolean {
		const androidInfo = this.getAndroidSupportInfo();
		return (
			androidInfo.isAndroid &&
			androidInfo.supportsWebNfc &&
			typeof window !== "undefined" &&
			"NDEFReader" in window
		);
	}

	/**
	 * Checks if a native bridge should be used instead of Web NFC
	 * This is useful to determine if we're in a Capacitor app context
	 */
	static shouldUseNativeBridge(): boolean {
		const androidInfo = this.getAndroidSupportInfo();
		if (!androidInfo.isAndroid) return false;

		// Check if we're in a WebView (Capacitor/Cordova context)
		const isWebView =
			/(capacitor|cordova)/i.test(navigator.userAgent) ||
			// Alternative detection for Android WebView
			(/android/i.test(navigator.userAgent) && /wv/i.test(navigator.userAgent));

		return isWebView && androidInfo.supportsNfc;
	}

	/**
	 * Provides guidance for enabling NFC on Android
	 */
	static getAndroidNfcGuidance(): string {
		const androidInfo = this.getAndroidSupportInfo();

		if (!androidInfo.isAndroid) {
			return "";
		}

		if (!androidInfo.supportsNfc) {
			return "Your Android device does not support NFC or is running an Android version below 4.0.";
		}

		return "To enable NFC on your Android device, go to Settings > Connected devices > Connection preferences > NFC and turn it on.";
	}
}
