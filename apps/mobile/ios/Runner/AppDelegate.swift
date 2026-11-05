import CoreTelephony
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    // es/net "radio": 5G / 4G / 3G / 2G of the mobile data connection (admin stats). No permission needed.
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "EsNet") {
      let channel = FlutterMethodChannel(name: "es/net", binaryMessenger: registrar.messenger())
      channel.setMethodCallHandler { call, result in
        guard call.method == "radio" else {
          result(FlutterMethodNotImplemented)
          return
        }
        let tech = CTTelephonyNetworkInfo().serviceCurrentRadioAccessTechnology?.values.first
        result(["radio": AppDelegate.radioName(tech)])
      }
    }
  }

  static func radioName(_ tech: String?) -> String {
    guard let t = tech else { return "" }
    if #available(iOS 14.1, *), t == CTRadioAccessTechnologyNR || t == CTRadioAccessTechnologyNRNSA { return "5G" }
    switch t {
    case CTRadioAccessTechnologyLTE: return "4G"
    case CTRadioAccessTechnologyWCDMA, CTRadioAccessTechnologyHSDPA, CTRadioAccessTechnologyHSUPA, CTRadioAccessTechnologyCDMAEVDORev0,
         CTRadioAccessTechnologyCDMAEVDORevA, CTRadioAccessTechnologyCDMAEVDORevB, CTRadioAccessTechnologyeHRPD: return "3G"
    case CTRadioAccessTechnologyGPRS, CTRadioAccessTechnologyEdge, CTRadioAccessTechnologyCDMA1x: return "2G"
    default: return ""
    }
  }
}
