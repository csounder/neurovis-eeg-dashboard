import Foundation

/**
 Muse EEG Bridge for macOS — LibMuse via `Muse.framework` (NeuroVis bundle / IXNMuseManagerMac).
 Connects to Muse 2 / Muse S class headsets and outputs JSON to stdout.
 */

// MARK: - JSON Logging Helper
func logJSON(_ object: [String: Any]) {
    do {
        let data = try JSONSerialization.data(withJSONObject: object)
        if let jsonString = String(data: data, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)
        }
    } catch {
        logError("JSON serialization failed: \(error)")
    }
}

func logError(_ message: String) {
    logJSON(["type": "error", "message": message])
}

func logInfo(_ message: String) {
    logJSON(["type": "status", "message": message])
}

// MARK: - Muse Manager
class MuseManager: NSObject, IXNMuseListener, IXNMuseDataListener {
    static let shared = MuseManager()

    var muses: [IXNMuse] = []
    var activeMuse: IXNMuse?
    var isConnected = false
    var museManager: IXNMuseManager?

    /// Log-scale absolute band powers (Bels), keyed delta…gamma — populated from separate packet types.
    private var pendingAbsBands: [String: Double] = [:]

    override init() {
        super.init()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.startDiscovery()
        }
    }

    // MARK: - Discovery & Connection
    func startDiscovery() {
        guard let manager = IXNMuseManagerMac.sharedManager() else {
            logError("Failed to get IXNMuseManagerMac.sharedManager()")
            return
        }
        museManager = manager
        manager.setMuseListener(self)
        manager.startListening()
        logInfo("🔍 Discovery started - scanning for Muse devices")
    }

    func stopDiscovery() {
        museManager?.stopListening()
        logInfo("Discovery stopped")
    }

    func connectToDevice(at index: Int) {
        guard index >= 0 && index < muses.count else {
            logError("Device index \(index) out of range")
            return
        }

        let muse = muses[index]
        activeMuse = muse

        // New LibMuse: one registration per packet type (no single “bandPowers” type).
        muse.register(self, type: .eeg)
        muse.register(self, type: .accelerometer)
        muse.register(self, type: .gyro)
        muse.register(self, type: .ppg)
        muse.register(self, type: .battery)
        muse.register(self, type: .deltaAbsolute)
        muse.register(self, type: .thetaAbsolute)
        muse.register(self, type: .alphaAbsolute)
        muse.register(self, type: .betaAbsolute)
        muse.register(self, type: .gammaAbsolute)

        logInfo("🔗 Connecting to \(muse.getName())...")

        muse.runAsynchronously()
        isConnected = true
    }

    func disconnectFromDevice() {
        guard let muse = activeMuse else { return }
        let name = muse.getName()
        pendingAbsBands.removeAll()
        muse.disconnect()
        activeMuse = nil
        isConnected = false
        logInfo("🔌 Disconnected from \(name)")
    }

    // MARK: - IXNMuseListener
    func museListChanged() {
        guard let manager = museManager else { return }

        muses = manager.getMuses() as? [IXNMuse] ?? []

        let devices = muses.enumerated().map { idx, muse -> [String: Any] in
            let connState = muse.getConnectionState()
            let isConn = connState == IXNConnectionState.connected

            return [
                "index": idx,
                "name": muse.getName(),
                "model": muse.getModel().rawValue,
                "connected": isConn,
            ]
        }

        logJSON([
            "type": "device_list",
            "count": devices.count,
            "devices": devices,
        ])

        if devices.isEmpty {
            logInfo("⏳ No Muse devices found - make sure Bluetooth is on and device is in pairing mode")
        }
    }

    // MARK: - Band helpers (absolute packets = log Bels per channel; average TP9/AF7/AF8/TP10)
    private func meanEegLogPower(_ packet: IXNMuseDataPacket) -> Double {
        let v1 = packet.getEegChannelValue(.EEG1)
        let v2 = packet.getEegChannelValue(.EEG2)
        let v3 = packet.getEegChannelValue(.EEG3)
        let v4 = packet.getEegChannelValue(.EEG4)
        return (v1 + v2 + v3 + v4) / 4.0
    }

    private func flushAbsBandsIfReady(packet: IXNMuseDataPacket, muse: IXNMuse) {
        let keys = ["delta", "theta", "alpha", "beta", "gamma"]
        guard keys.allSatisfy({ pendingAbsBands[$0] != nil }) else { return }

        let deltaPower = pendingAbsBands["delta"]!
        let thetaPower = pendingAbsBands["theta"]!
        let alphaPower = pendingAbsBands["alpha"]!
        let betaPower = pendingAbsBands["beta"]!
        let gammaPower = pendingAbsBands["gamma"]!
        pendingAbsBands.removeAll()

        let deltaLinear = pow(10.0, deltaPower)
        let thetaLinear = pow(10.0, thetaPower)
        let alphaLinear = pow(10.0, alphaPower)
        let betaLinear = pow(10.0, betaPower)
        let gammaLinear = pow(10.0, gammaPower)
        let totalLinear = deltaLinear + thetaLinear + alphaLinear + betaLinear + gammaLinear
        guard totalLinear > 0 else { return }

        logJSON([
            "type": "bandPowers",
            "timestamp": packet.timestamp(),
            "absolute": [
                "delta": deltaPower,
                "theta": thetaPower,
                "alpha": alphaPower,
                "beta": betaPower,
                "gamma": gammaPower,
            ],
            "relative": [
                "delta": deltaLinear / totalLinear,
                "theta": thetaLinear / totalLinear,
                "alpha": alphaLinear / totalLinear,
                "beta": betaLinear / totalLinear,
                "gamma": gammaLinear / totalLinear,
            ],
            "deviceName": muse.getName(),
        ])
    }

    // MARK: - IXNMuseDataListener
    func receive(_ packet: IXNMuseDataPacket?, muse: IXNMuse?) {
        guard let packet = packet else { return }
        guard let muse = muse else { return }

        switch packet.packetType() {
        case .eeg:
            handleEEGData(packet, muse)
        case .accelerometer:
            handleAccelerometer(packet, muse)
        case .gyro:
            handleGyroscope(packet, muse)
        case .ppg:
            handlePPG(packet, muse)
        case .battery:
            handleBattery(packet, muse)
        case .deltaAbsolute:
            pendingAbsBands["delta"] = meanEegLogPower(packet)
            flushAbsBandsIfReady(packet: packet, muse: muse)
        case .thetaAbsolute:
            pendingAbsBands["theta"] = meanEegLogPower(packet)
            flushAbsBandsIfReady(packet: packet, muse: muse)
        case .alphaAbsolute:
            pendingAbsBands["alpha"] = meanEegLogPower(packet)
            flushAbsBandsIfReady(packet: packet, muse: muse)
        case .betaAbsolute:
            pendingAbsBands["beta"] = meanEegLogPower(packet)
            flushAbsBandsIfReady(packet: packet, muse: muse)
        case .gammaAbsolute:
            pendingAbsBands["gamma"] = meanEegLogPower(packet)
            flushAbsBandsIfReady(packet: packet, muse: muse)
        default:
            break
        }
    }

    // MARK: - EEG Data Handler (256 Hz)
    func handleEEGData(_ packet: IXNMuseDataPacket, _ muse: IXNMuse) {
        let eeg = [
            packet.getEegChannelValue(.EEG1),
            packet.getEegChannelValue(.EEG2),
            packet.getEegChannelValue(.EEG3),
            packet.getEegChannelValue(.EEG4),
        ]

        logJSON([
            "type": "eeg",
            "timestamp": packet.timestamp(),
            "eeg": eeg,
            "deviceName": muse.getName(),
        ])
    }

    // MARK: - Motion Handlers
    func handleAccelerometer(_ packet: IXNMuseDataPacket, _ muse: IXNMuse) {
        let accel = [
            packet.getAccelerometerValue(.X),
            packet.getAccelerometerValue(.Y),
            packet.getAccelerometerValue(.Z),
        ]

        logJSON([
            "type": "accelerometer",
            "timestamp": packet.timestamp(),
            "accel": accel,
            "deviceName": muse.getName(),
        ])
    }

    func handleGyroscope(_ packet: IXNMuseDataPacket, _ muse: IXNMuse) {
        let gyro = [
            packet.getGyroValue(.X),
            packet.getGyroValue(.Y),
            packet.getGyroValue(.Z),
        ]

        logJSON([
            "type": "gyroscope",
            "timestamp": packet.timestamp(),
            "gyro": gyro,
            "deviceName": muse.getName(),
        ])
    }

    // MARK: - PPG — [red, green/ambient slot, ir] to match older bridge field order
    func handlePPG(_ packet: IXNMuseDataPacket, _ muse: IXNMuse) {
        let red = packet.getPpgChannelValue(.RED)
        let mid = packet.getPpgChannelValue(.AMBIENT)
        let ir = packet.getPpgChannelValue(.IR)

        logJSON([
            "type": "ppg",
            "timestamp": packet.timestamp(),
            "ppg": [red, mid, ir],
            "deviceName": muse.getName(),
        ])
    }

    func handleBattery(_ packet: IXNMuseDataPacket, _ muse: IXNMuse) {
        let batteryLevel = packet.getBatteryValue(.chargePercentageRemaining)

        logJSON([
            "type": "battery",
            "timestamp": packet.timestamp(),
            "percentage": batteryLevel,
            "deviceName": muse.getName(),
        ])
    }

    func receive(_ packet: IXNMuseArtifactPacket, muse: IXNMuse?) {
        // Optional: blink / jaw, etc.
    }
}

// MARK: - Main
logInfo("🧠 Muse EEG Bridge v1.0 Starting...")

let museManager = MuseManager.shared

logInfo("✓ Ready - listening for Muse devices")

Thread {
    while true {
        guard let line = readLine(strippingNewline: true) else {
            Thread.sleep(forTimeInterval: 0.2)
            continue
        }
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { continue }
        guard let data = trimmed.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let cmd = obj["command"] as? String
        else {
            continue
        }
        DispatchQueue.main.async {
            switch cmd {
            case "disconnect":
                MuseManager.shared.disconnectFromDevice()
            case "connect":
                let idx: Int?
                if let i = obj["deviceIndex"] as? Int {
                    idx = i
                } else if let n = obj["deviceIndex"] as? NSNumber {
                    idx = n.intValue
                } else if let d = obj["deviceIndex"] as? Double {
                    idx = Int(d)
                } else {
                    idx = nil
                }
                if let idx {
                    MuseManager.shared.connectToDevice(at: idx)
                }
            default:
                break
            }
        }
    }
}.start()

RunLoop.main.run()
