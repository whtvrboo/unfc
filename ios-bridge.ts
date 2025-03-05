import { NfcPlugin, IsEnabledResult, TagDetectedEvent } from './definitions.js';

/**
 * Interface for native iOS app to implement for WebView communication
 */
interface NativeIosBridge {
    isNfcEnabled?: () => Promise<boolean>;
    startNfcScan?: (options: string) => Promise<void>;
    stopNfcScan?: () => Promise<void>;
    writeNfcTag?: (data: string) => Promise<void>;
    openSettings?: () => Promise<void>;
}

/**
 * NFC implementation that communicates with a native iOS app via a bridge
 * Note: This requires custom implementation in a native iOS app
 */
export class IosBridgeNfc implements NfcPlugin {
    private bridge: NativeIosBridge;
    private listeners: { [key: string]: Array<(...args: any[]) => void> } = {};
    private isBridgeAvailable: boolean = false;

    constructor() {
        // Look for the bridge in the global scope
        // The native app needs to inject this object 
        this.bridge = (window as any).nativeNfcBridge || {};
        this.isBridgeAvailable = !!(this.bridge.isNfcEnabled && this.bridge.startNfcScan);

        // Set up message listener for tag detection events from native app
        if (this.isBridgeAvailable) {
            window.addEventListener('message', this.handleNativeMessage.bind(this));
            console.log('iOS NFC bridge initialized');
        } else {
            console.warn('iOS NFC bridge not found');
        }
    }

    private handleNativeMessage(event: MessageEvent) {
        if (!event.data || typeof event.data !== 'object') return;

        // Handle tag detected message from native app
        if (event.data.type === 'nfcTagDetected' && event.data.tag) {
            const tagListeners = this.listeners['tagDetected'] || [];
            const tag = event.data.tag as TagDetectedEvent;

            for (const listener of tagListeners) {
                listener(tag);
            }
        }

        // Handle NFC status change from native app
        if (event.data.type === 'nfcStatusChanged' && event.data.enabled !== undefined) {
            const statusListeners = this.listeners['nfcStatusChanged'] || [];

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
            console.error('Error checking NFC status through bridge:', error);
            return { enabled: false };
        }
    }

    async openSettings(): Promise<void> {
        if (!this.isBridgeAvailable || !this.bridge.openSettings) {
            throw new Error('NFC settings cannot be opened - bridge not available');
        }

        try {
            await this.bridge.openSettings();
        } catch (error) {
            console.error('Error opening NFC settings through bridge:', error);
            throw error;
        }
    }

    async startScanSession(options?: any): Promise<void> {
        if (!this.isBridgeAvailable) {
            throw new Error('NFC scan cannot be started - bridge not available');
        }

        try {
            await this.bridge.startNfcScan!(JSON.stringify(options || {}));
        } catch (error) {
            console.error('Error starting NFC scan through bridge:', error);
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
            console.error('Error stopping NFC scan through bridge:', error);
        }
    }

    async write(options: any): Promise<void> {
        if (!this.isBridgeAvailable || !this.bridge.writeNfcTag) {
            throw new Error('NFC write is not supported - bridge not available');
        }

        try {
            await this.bridge.writeNfcTag!(JSON.stringify(options));
        } catch (error) {
            console.error('Error writing NFC tag through bridge:', error);
            throw error;
        }
    }

    async makeReadOnly(): Promise<void> {
        throw new Error('makeReadOnly is not implemented in the iOS bridge');
    }

    async format(): Promise<void> {
        throw new Error('format is not implemented in the iOS bridge');
    }

    async erase(): Promise<void> {
        throw new Error('erase is not implemented in the iOS bridge');
    }

    async share(): Promise<void> {
        throw new Error('share is not supported in iOS');
    }

    async stopSharing(): Promise<void> {
        throw new Error('share is not supported in iOS');
    }

    async addListener(
        eventName: 'nfcStatusChanged' | 'tagDetected',
        listenerFunc: (data: any) => void,
    ): Promise<any> {
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

    private removeListener(eventName: string, listenerFunc: (data: any) => void): void {
        if (this.listeners[eventName]) {
            this.listeners[eventName] = this.listeners[eventName].filter(
                listener => listener !== listenerFunc
            );
        }
    }

    async removeAllListeners(): Promise<void> {
        this.listeners = {};
    }
}
