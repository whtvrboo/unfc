# Universal NFC

A framework-agnostic NFC package for reading and writing NFC tags in web applications and Progressive Web Apps (PWAs), with iOS support options. This library provides a consistent API for working with NFC across different environments, with a focus on ease of use and developer experience.

[![NPM Version](https://img.shields.io/npm/v/unfc)](https://www.npmjs.com/package/unfc)
[![NPM Downloads](https://img.shields.io/npm/d18m/unfc)](https://www.npmjs.com/package/unfc)

## Features

- 📱 Read NFC tags in web apps and PWAs
- ✍️ Write data to NFC tags
- 🌐 Framework-agnostic - works with React, Vue, Angular, vanilla JS, etc.
- 📦 Lightweight, with no external dependencies
- 📊 TypeScript support with comprehensive type definitions
- 🔄 Simple and advanced APIs for different use cases
- 🔌 Based on the Web NFC API standard
- 🍎 iOS support via native bridge integration

## Installation

```bash
npm install unfc
```

or

```bash
yarn add unfc
```

## Platform Compatibility

| Feature     | Chrome for Android (89+) | Chrome for Desktop | Safari iOS | Native iOS Apps | Native Android Apps | Firefox | Edge |
| ----------- | ------------------------ | ------------------ | ---------- | --------------- | ------------------- | ------- | ---- |
| Reading NFC | ✅                       | ❌                 | ❌         | ✅\*            | ✅                  | ❌      | ❌   |
| Writing NFC | ✅                       | ❌                 | ❌         | ✅\*            | ✅                  | ❌      | ❌   |

\*iOS support requires a native app with an embedded WebView and bridge implementation.

**Requirements for Web NFC:**

- Chrome 89+ on Android
- HTTPS connection (or localhost for development)
- Device with NFC hardware
- NFC enabled in device settings

**Requirements for iOS NFC:**

- iOS 11+ device with NFC hardware
- Native iOS app with NFC entitlements
- Core NFC framework integration
- Custom bridge implementation (see iOS Integration section)

## Basic Usage

### Reading NFC Tags (Simple API)

The simplest way to read NFC tags:

```javascript
import { SimpleNfc } from "unfc";

const nfcReader = new SimpleNfc();

async function startReading() {
	// First check if NFC is available
	const available = await nfcReader.isAvailable();

	if (!available) {
		console.log("NFC is not available on this device/browser");
		return;
	}

	try {
		// Start reading NFC tags with a callback
		await nfcReader.startReading((content, type) => {
			console.log(`Read ${type} content:`, content);

			// 'type' will be 'text', 'url', or 'other'
			if (type === "url") {
				// Handle URL
				window.open(content, "_blank");
			} else {
				// Handle text or other content
				document.getElementById("result").textContent = content;
			}
		});

		console.log("Scan started - tap an NFC tag");
	} catch (error) {
		console.error("Error starting NFC scan:", error);
	}
}

function stopReading() {
	nfcReader.stopReading();
	console.log("NFC reading stopped");
}
```

### Writing to NFC Tags

```javascript
import { SimpleNfc } from "unfc";

const nfcWriter = new SimpleNfc();

async function writeTextToTag() {
	try {
		await nfcWriter.writeText("Hello from Universal NFC!");
		console.log("Tag written successfully! Tap a tag to write.");
	} catch (error) {
		console.error("Error writing to tag:", error);
	}
}

async function writeUrlToTag() {
	try {
		await nfcWriter.writeUrl("https://example.com");
		console.log("URL written successfully! Tap a tag to write.");
	} catch (error) {
		console.error("Error writing URL to tag:", error);
	}
}
```

## iOS Integration

### Overview

iOS devices with NFC hardware (iPhone 7 and later running iOS 11+) support reading NFC tags, but with some important restrictions:

- **Safari browser cannot directly access NFC**: The Web NFC API is not supported in Safari.
- **Native app required**: NFC on iOS requires a native app built with the Core NFC framework.
- **Web apps can access NFC through a bridge**: Web content running in a WebView inside a native app can access NFC via a custom bridge.

### iOS Native Bridge Setup

To use Universal NFC with iOS, you need to:

1. Create a native iOS app with WebView.
2. Implement Core NFC.
3. Create a JavaScript bridge.

#### 1. Native iOS App with NFC Capabilities

First, ensure your app has NFC entitlements:

- Add the NFC entitlement to your app in Xcode.
- Add `NFCReaderUsageDescription` in `Info.plist`.
- Enable the "Near Field Communication Tag Reading" capability.

#### 2. Implement the NFC Bridge in Swift

```swift
import WebKit
import CoreNFC

class NfcBridge: NSObject, NFCNDEFReaderSessionDelegate {
    weak var webView: WKWebView?
    var nfcSession: NFCNDEFReaderSession?

    init(webView: WKWebView) {
        self.webView = webView
        super.init()

        // Register JavaScript interface
        let bridgeScript = WKUserScript(
            source: "window.nativeNfcBridge = {
                isNfcEnabled: function() { return window.webkit.messageHandlers.nfcBridge.postMessage({action: 'isEnabled'}); },
                startNfcScan: function(options) { return window.webkit.messageHandlers.nfcBridge.postMessage({action: 'startScan', options: options}); },
                stopNfcScan: function() { return window.webkit.messageHandlers.nfcBridge.postMessage({action: 'stopScan'}); },
                writeNfcTag: function(data) { return window.webkit.messageHandlers.nfcBridge.postMessage({action: 'writeTag', data: data}); },
                openSettings: function() { return window.webkit.messageHandlers.nfcBridge.postMessage({action: 'openSettings'}); }
            };",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )

        let contentController = webView.configuration.userContentController
        contentController.addUserScript(bridgeScript)
        contentController.add(self, name: "nfcBridge")
    }

    // Handle JavaScript messages
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }

        switch action {
        case "isEnabled":
            checkNfcAvailability()
        case "startScan":
            let options = body["options"] as? String ?? "{}"
            startNfcSession(options: options)
        case "stopScan":
            stopNfcSession()
        case "writeTag":
            if let data = body["data"] as? String {
                writeNfcTag(data: data)
            }
        case "openSettings":
            openSettings()
        default:
            break
        }
    }

    private func checkNfcAvailability() {
        let isAvailable = NFCNDEFReaderSession.readingAvailable
        sendToWebView(script: "window.dispatchEvent(new MessageEvent('message', {data: {type: 'nfcStatusChanged', enabled: \(isAvailable)}}));")
    }

    private func startNfcSession(options: String) {
        guard NFCNDEFReaderSession.readingAvailable else {
            sendToWebView(script: "console.error('NFC reading not available on this device');")
            return
        }

        nfcSession = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: false)
        nfcSession?.alertMessage = "Hold your iPhone near an NFC tag"
        nfcSession?.begin()
    }

    private func stopNfcSession() {
        nfcSession?.invalidate()
        nfcSession = nil
    }

    private func writeNfcTag(data: String) {
        // Implement write logic
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            DispatchQueue.main.async {
                UIApplication.shared.open(url)
            }
        }
    }

    private func sendToWebView(script: String) {
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
    }
}
```

#### 3. Initialize the Bridge in Your View Controller

```swift
import UIKit
import WebKit

class WebViewController: UIViewController {
    var webView: WKWebView!
    var nfcBridge: NfcBridge!

    override func viewDidLoad() {
        super.viewDidLoad()

        webView = WKWebView(frame: view.bounds)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(webView)

        nfcBridge = NfcBridge(webView: webView)

        if let url = URL(string: "https://your-web-app-url.com") {
            webView.load(URLRequest(url: url))
        }
    }
}
```

### Using the iOS Bridge in Your Web App

The native bridge will automatically be detected by Universal NFC when your web app runs inside the native iOS app's WebView:

```javascript
import { Nfc } from "unfc";

const nfc = new Nfc();

async function checkNfcSupport() {
	const { enabled } = await nfc.isEnabled();
	console.log("NFC supported and enabled:", enabled);

	if (enabled) {
		await nfc.startScanSession();

		await nfc.addListener("tagDetected", (tag) => {
			console.log("NFC tag detected via iOS bridge:", tag);
		});
	}
}
```

### Troubleshooting iOS-Specific Issues

#### "NFC reading is not supported in web browsers on iOS"

- This error occurs when trying to use NFC in Safari or a standard WebView.
- **Solution**: Use the native bridge approach with a custom iOS app.

#### "CoreNFC framework missing"

- Make sure you have the proper entitlements in your iOS app.
- Check that your iOS device supports NFC (iPhone 7 and later).

#### "Bridge communication error"

- Check the bridge implementation in your native app.
- Verify message format passed between WebView and native code.

## API Reference

### Core API (Nfc class)

The `Nfc` class provides comprehensive access to NFC functionality.

```javascript
import { Nfc } from "unfc";

const nfc = new Nfc();
```

#### Methods

- **isEnabled()**: `Promise<{enabled: boolean}>` - Check if NFC is available
- **openSettings()**: `Promise<void>` - Open NFC settings or provide guidance
- **startScanSession(options?)**: `Promise<void>` - Start scanning for NFC tags
  - `options.once`: Stop after first tag (default: false)
  - `options.scanSoundEnabled`: Play sound on detection (iOS only, default: false)
  - `options.alertMessageEnabled`: Show alert on start (iOS only, default: false)
- **stopScanSession()**: `Promise<void>` - Stop scanning for NFC tags
- **write(options)**: `Promise<void>` - Write NDEF data to a tag
- **format()**: `Promise<void>` - Format a tag
- **erase()**: `Promise<void>` - Erase a tag's content
- **makeReadOnly()**: `Promise<void>` - Make a tag read-only (permanent)
- **addListener(eventName, callback)**: `Promise<{remove: () => Promise<void>}>` - Register event listener
- **removeAllListeners()**: `Promise<void>` - Remove all event listeners

#### Events

- **tagDetected**: Fires when an NFC tag is detected
- **nfcStatusChanged**: Fires when NFC availability changes

### Simple API (SimpleNfc class)

The `SimpleNfc` class provides a simplified interface for common NFC operations.

```javascript
import { SimpleNfc } from "unfc";

const nfc = new SimpleNfc();
```

#### Methods

- **isAvailable()**: `Promise<boolean>` - Check if NFC is available
- **startReading(callback)**: `Promise<void>` - Start reading tags with a simplified callback
  - `callback(content, type)`: Called with the tag's content and type ('text', 'url', or 'other')
- **stopReading()**: `Promise<void>` - Stop reading tags
- **writeText(text)**: `Promise<void>` - Write text to a tag
- **writeUrl(url)**: `Promise<void>` - Write URL to a tag

### Utilities (NfcUtils)

```javascript
import { NfcUtils } from "unfc";
```

#### Methods

- **createTextRecord(text, languageCode?)**: Create a text NDEF record
- **createUriRecord(uri)**: Create a URI NDEF record
- **createMessage(records)**: Create an NDEF message from records
- **getTextFromTag(tag)**: Extract text content from a tag
- **getUrlFromTag(tag)**: Extract URL content from a tag
- **isWebNfcSupported()**: Check if Web NFC API is supported
- **isNfcLikelyAvailable()**: Check if device likely has NFC hardware

## Advanced Usage

### Using the Core API for Tag Reading

```javascript
import { Nfc } from "unfc";

const nfc = new Nfc();

async function setupNfcReader() {
	try {
		const { enabled } = await nfc.isEnabled();

		if (!enabled) {
			console.log("NFC is not enabled or supported");
			return;
		}

		// Register tag detection handler
		await nfc.addListener("tagDetected", (tag) => {
			console.log("Tag ID:", tag.id);
			console.log("Technology types:", tag.techTypes);

			// Process NDEF messages
			if (tag.messages && tag.messages.length > 0) {
				for (const message of tag.messages) {
					for (const record of message.records) {
						console.log("Record type:", record.type);
						console.log("Record payload:", record.payload);

						// Handle different record types
						if (record.type === "T") {
							console.log("Text:", record.text || record.payload);
						} else if (record.type === "U") {
							console.log("URL:", record.uri || record.payload);
						}
					}
				}
			}
		});

		// Start scanning
		await nfc.startScanSession();
		console.log("NFC scanning started");
	} catch (error) {
		console.error("NFC setup error:", error);
	}
}

function cleanupNfcReader() {
	nfc
		.stopScanSession()
		.then(() => nfc.removeAllListeners())
		.then(() => {
			console.log("NFC reader cleaned up");
		})
		.catch(console.error);
}
```

### Writing Custom Record Types

```javascript
import { Nfc, NfcTnf, NfcUtils } from "unfc";

const nfc = new Nfc();

async function writeCustomData() {
	// Create a custom record
	const customRecord = {
		id: "",
		tnf: NfcTnf.MIME_MEDIA,
		type: "application/json",
		payload: JSON.stringify({ id: 123, name: "Custom Data" }),
	};

	// Create a message with the custom record and a text record
	const textRecord = NfcUtils.createTextRecord("This tag contains custom data");
	const message = NfcUtils.createMessage([textRecord, customRecord]);

	try {
		// Write the message to a tag
		await nfc.write({ message });
		console.log("Tag written successfully! Tap a tag to write.");
	} catch (error) {
		console.error("Error writing tag:", error);
	}
}
```

## Handling NFC in a React Application

```jsx
import React, { useState, useEffect } from "react";
import { SimpleNfc } from "unfc";

function NfcReader() {
	const [isReading, setIsReading] = useState(false);
	const [isAvailable, setIsAvailable] = useState(false);
	const [tagContent, setTagContent] = useState("");
	const [error, setError] = useState("");
	const nfcReader = React.useMemo(() => new SimpleNfc(), []);

	useEffect(() => {
		// Check if NFC is available when component mounts
		nfcReader
			.isAvailable()
			.then((available) => {
				setIsAvailable(available);
				if (!available) {
					setError("NFC is not available on this device or browser");
				}
			})
			.catch((err) => {
				setError("Error checking NFC availability: " + err.message);
			});

		// Cleanup when component unmounts
		return () => {
			if (isReading) {
				nfcReader.stopReading().catch(console.error);
			}
		};
	}, [nfcReader]);

	const startReading = async () => {
		try {
			setError("");
			setIsReading(true);

			await nfcReader.startReading((content, type) => {
				setTagContent(`${type}: ${content}`);
			});
		} catch (err) {
			setError("Error starting NFC: " + err.message);
			setIsReading(false);
		}
	};

	const stopReading = async () => {
		try {
			await nfcReader.stopReading();
			setIsReading(false);
		} catch (err) {
			setError("Error stopping NFC: " + err.message);
		}
	};

	return (
		<div>
			<h2>NFC Reader</h2>

			{error && <div className="error">{error}</div>}

			<div>
				<button
					onClick={isReading ? stopReading : startReading}
					disabled={!isAvailable}>
					{isReading ? "Stop Reading" : "Start Reading"}
				</button>
			</div>

			{isReading && <p>Ready to scan: tap an NFC tag against your device</p>}

			{tagContent && (
				<div className="tag-content">
					<h3>Tag Content:</h3>
					<p>{tagContent}</p>
				</div>
			)}
		</div>
	);
}

export default NfcReader;
```

## Requirements for PWA Integration

To use NFC in a Progressive Web App (PWA):

1. **HTTPS**: Your app must be served over HTTPS (except for localhost during development)
2. **Web App Manifest**: Include an appropriate manifest file:

```json
{
	"name": "NFC Reader App",
	"short_name": "NFC App",
	"start_url": "/",
	"display": "standalone",
	"background_color": "#ffffff",
	"theme_color": "#4285f4",
	"icons": [
		{
			"src": "icon-192.png",
			"sizes": "192x192",
			"type": "image/png"
		},
		{
			"src": "icon-512.png",
			"sizes": "512x512",
			"type": "image/png"
		}
	]
}
```

3. **Service Worker**: Register a service worker to make your app work offline

```javascript
// register-sw.js
if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("/service-worker.js")
			.then((registration) => {
				console.log("Service Worker registered");
			})
			.catch((error) => {
				console.error("Service Worker registration failed:", error);
			});
	});
}
```

4. **Permission Policy**: You may need to include a permission policy header for NFC:

```
Permissions-Policy: nfc=self
```

## Troubleshooting

### NFC Not Working

1. **Check Compatibility**: Ensure you're using Chrome 89+ on Android
2. **HTTPS Required**: Make sure your app is served over HTTPS (except on localhost)
3. **NFC Hardware**: Verify your device has NFC hardware
4. **NFC Enabled**: Ensure NFC is enabled in your device settings
5. **Permission**: The user must grant permission when prompted
6. **Tag Positioning**: Position the tag correctly against the NFC sensor

### Common Errors

- **"NotSupportedError"**: Browser doesn't support Web NFC API
- **"NotAllowedError"**: User denied permission or NFC is disabled
- **"NetworkError"**: Problem communicating with the NFC tag
- **"AbortError"**: The operation was cancelled
- **"NotFoundError"**: No NFC tag in range or tag removed too quickly

## License

MIT
