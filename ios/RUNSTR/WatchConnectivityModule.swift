//
//  WatchConnectivityModule.swift
//  RUNSTR
//
//  Native module for WatchConnectivity to transfer Nostr credentials to Apple Watch
//

import WatchConnectivity
import React

@objc(WatchConnectivityModule)
class WatchConnectivityModule: NSObject {

    private var session: WCSession?

    override init() {
        super.init()
        if WCSession.isSupported() {
            session = WCSession.default
            session?.delegate = self
            session?.activate()
        }
    }

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    /// Get current watch connection state
    @objc func getWatchState(_ resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        guard let session = session else {
            resolve([
                "isPaired": false,
                "isWatchAppInstalled": false,
                "isReachable": false,
                "isSupported": false
            ])
            return
        }

        resolve([
            "isPaired": session.isPaired,
            "isWatchAppInstalled": session.isWatchAppInstalled,
            "isReachable": session.isReachable,
            "isSupported": true
        ])
    }

    /// Sync Nostr credentials to Apple Watch via transferUserInfo (queued, reliable delivery)
    @objc func syncCredentialsToWatch(_ credentials: NSDictionary,
                                       resolve: @escaping RCTPromiseResolveBlock,
                                       reject: @escaping RCTPromiseRejectBlock) {
        guard let session = session else {
            reject("NO_SESSION", "WatchConnectivity not supported", nil)
            return
        }

        guard session.isPaired else {
            reject("NOT_PAIRED", "No Apple Watch paired", nil)
            return
        }

        guard session.isWatchAppInstalled else {
            reject("APP_NOT_INSTALLED", "RUNSTR Watch app not installed", nil)
            return
        }

        guard let nsec = credentials["nsec"] as? String,
              let npub = credentials["npub"] as? String,
              let privateKeyHex = credentials["privateKeyHex"] as? String,
              let publicKeyHex = credentials["publicKeyHex"] as? String else {
            reject("INVALID_CREDENTIALS", "Missing required credential fields", nil)
            return
        }

        let userInfo: [String: Any] = [
            "type": "nostr_credentials",
            "nsec": nsec,
            "npub": npub,
            "privateKeyHex": privateKeyHex,
            "publicKeyHex": publicKeyHex,
            "timestamp": Date().timeIntervalSince1970
        ]

        // transferUserInfo queues the data for delivery even if watch isn't reachable
        session.transferUserInfo(userInfo)
        print("[WatchConnectivity] Credentials queued for transfer to watch")

        resolve(["success": true])
    }
}

// MARK: - WCSessionDelegate
extension WatchConnectivityModule: WCSessionDelegate {

    func session(_ session: WCSession,
                 activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {
        if let error = error {
            print("[WatchConnectivity] Activation failed: \(error.localizedDescription)")
        } else {
            print("[WatchConnectivity] Activation completed: \(activationState.rawValue)")
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {
        print("[WatchConnectivity] Session became inactive")
    }

    func sessionDidDeactivate(_ session: WCSession) {
        print("[WatchConnectivity] Session deactivated, reactivating...")
        session.activate()
    }
}
