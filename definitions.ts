export interface NfcPlugin {
	/**
	 * Check if NFC is enabled (Android) or available (iOS/Web).
	 */
	isEnabled(): Promise<IsEnabledResult>;

	/**
	 * Open NFC settings (Android) or app settings (iOS) or shows guidance (Web).
	 */
	openSettings(): Promise<void>;

	/**
	 * Register a callback that will be invoked when NFC status changes.
	 */
	addListener(
		eventName: "nfcStatusChanged",
		listenerFunc: (status: NfcStatusChangedEvent) => void
	): Promise<PluginListenerHandle>;

	/**
	 * Start a read session and register a callback that will be invoked when NFC tags are detected.
	 */
	startScanSession(options?: StartScanSessionOptions): Promise<void>;

	/**
	 * Stop the current scan session.
	 */
	stopScanSession(): Promise<void>;

	/**
	 * Register a callback that will be invoked when NFC tags are detected.
	 */
	addListener(
		eventName: "tagDetected",
		listenerFunc: (tag: TagDetectedEvent) => void
	): Promise<PluginListenerHandle>;

	/**
	 * Write an NDEF message to an NFC tag.
	 */
	write(options: WriteOptions): Promise<void>;

	/**
	 * Make an NFC tag read-only. After calling this method, it is no longer possible to write data to the tag.
	 * BE CAREFUL: This is a one-way process and cannot be undone.
	 */
	makeReadOnly(): Promise<void>;

	/**
	 * Format an unformatted NFC tag.
	 */
	format(): Promise<void>;

	/**
	 * Erase a formatted NFC tag.
	 */
	erase(): Promise<void>;

	/**
	 * Transfer data via NFC.
	 * Only available on Android.
	 */
	share(options: ShareOptions): Promise<void>;

	/**
	 * Stop sharing data via NFC.
	 * Only available on Android.
	 */
	stopSharing(): Promise<void>;

	/**
	 * Remove all listeners for this plugin.
	 */
	removeAllListeners(): Promise<void>;
}

export interface IsEnabledResult {
	/**
	 * Whether NFC is enabled or not.
	 */
	enabled: boolean;
}

export interface NfcStatusChangedEvent {
	/**
	 * Whether NFC was enabled or disabled.
	 */
	enabled: boolean;
}

export interface StartScanSessionOptions {
	/**
	 * If `true`, the scan session is stopped after the first tag is detected.
	 * Default: `false`
	 */
	once?: boolean;
	/**
	 * If `true`, a scan feedback (sound) is played when a tag is detected.
	 * Only available on iOS.
	 * Default: `false`
	 */
	scanSoundEnabled?: boolean;
	/**
	 * If `true`, the scan session is started with alert message.
	 * Only available on iOS.
	 * Default: `false`
	 */
	alertMessageEnabled?: boolean;
}

export interface TagDetectedEvent {
	/**
	 * The ID (serial number) of the tag.
	 */
	id: string;
	/**
	 * The tech types of the tag (e.g. 'ndef', 'mifare', etc.).
	 */
	techTypes: string[];
	/**
	 * The NDEF messages contained in the tag.
	 */
	messages: NdefMessage[];
}

export interface NdefMessage {
	/**
	 * The NDEF records contained in the message.
	 */
	records: NdefRecord[];
}

export interface NdefRecord {
	/**
	 * The ID of the record. May be empty.
	 */
	id: string;
	/**
	 * The TNF (Type Name Format) of the record.
	 * @see NfcTnf for possible values.
	 */
	tnf: number;
	/**
	 * The type of the record (e.g. 'T' for text, 'U' for URI).
	 */
	type: string;
	/**
	 * The payload of the record as string, if available.
	 */
	payload?: string;
	/**
	 * The language code of the record (for text records).
	 * Only consistently available on Android.
	 */
	languageCode?: string;
	/**
	 * The URI of the record (for URI records).
	 */
	uri?: string;
	/**
	 * The text content of the record (for text records).
	 */
	text?: string;
}

export interface WriteOptions {
	/**
	 * The NDEF message to write.
	 */
	message: NdefMessage;
}

export interface ShareOptions {
	/**
	 * The NDEF message to share.
	 */
	message: NdefMessage;
}

export interface PluginListenerHandle {
	/**
	 * Remove the listener.
	 */
	remove: () => Promise<void>;
}

/**
 * NFC TNF (Type Name Format) Constants
 * These determine how to interpret the type field.
 */
export enum NfcTnf {
	EMPTY = 0x0,
	WELL_KNOWN = 0x01,
	MIME_MEDIA = 0x02,
	ABSOLUTE_URI = 0x03,
	EXTERNAL_TYPE = 0x04,
	UNKNOWN = 0x05,
	UNCHANGED = 0x06,
	RESERVED = 0x07,
}

/**
 * NFC RTD (Record Type Definition) Constants
 * These are standardized type names for common record types.
 */
export class NfcRtd {
	public static readonly TEXT = "T";
	public static readonly URI = "U";
	public static readonly SMART_POSTER = "Sp";
	public static readonly ALTERNATIVE_CARRIER = "ac";
	public static readonly HANDOVER_CARRIER = "Hc";
	public static readonly HANDOVER_REQUEST = "Hr";
	public static readonly HANDOVER_SELECT = "Hs";
}

/**
 * Error codes that might be returned by NFC operations
 */
export enum NfcErrorType {
	NOT_SUPPORTED = "not_supported",
	NOT_ENABLED = "not_enabled",
	PERMISSION_DENIED = "permission_denied",
	NO_TAG = "no_tag",
	TAG_ERROR = "tag_error",
	IO_ERROR = "io_error",
	TIMEOUT = "timeout",
	CANCELLED = "cancelled",
	UNEXPECTED_ERROR = "unexpected_error",
}

/**
 * Standard error structure for NFC operations
 */
export interface NfcError extends Error {
	code: NfcErrorType;
	message: string;
	detail?: any;
}

export interface NFCDefinition {
	// Define your NFC interface here
	id: string;
	data: string;
}
