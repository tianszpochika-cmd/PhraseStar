import Foundation
import Security

/**
 * Narrow iOS implementation for exactly one refresh-token key.
 *
 * A generic-password item stays app-local (no access group), is explicitly
 * non-synchronizing, and is readable only when the device is unlocked and only
 * on this device. No application fallback storage is touched.
 */
public final class YXSecureStorageNative {
    private static let key = "yx.auth.mobile.refresh-token"
    private static let service = "app.englishflow.mobile.secure"
    private static let maxValueBytes = 16 * 1024
    private static let lock = NSLock()

    private enum FailureCode: String {
        case invalidKey = "invalid_key"
        case invalidValue = "invalid_value"
        case valueTooLarge = "value_too_large"
        case keychainOSStatus = "keychain_osstatus"
        case keychainDataInvalid = "keychain_data_invalid"
        case encodingInvalid = "encoding_invalid"
        case envelopeFailed = "envelope_failed"
    }

    public static func read(_ requestedKey: String) -> String {
        if requestedKey != key { return failure(.invalidKey, 0, "Unsupported secure-storage key.") }
        lock.lock()
        defer { lock.unlock() }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return success(nil) }
        guard status == errSecSuccess else { return failure(.keychainOSStatus, status, "Keychain read failed.") }
        guard let data = item as? Data else { return failure(.keychainDataInvalid, status, "Keychain returned a non-data item.") }
        if data.count > maxValueBytes { return failure(.valueTooLarge, status, "Stored value exceeds the bound.") }
        guard let value = String(data: data, encoding: .utf8) else {
            return failure(.encodingInvalid, status, "Stored value is not valid UTF-8.")
        }
        return success(value)
    }

    public static func write(_ requestedKey: String, _ value: String) -> String {
        if requestedKey != key { return failure(.invalidKey, 0, "Unsupported secure-storage key.") }
        guard !value.isEmpty else { return failure(.invalidValue, 0, "Refusing to store an empty value.") }
        guard let data = value.data(using: .utf8), data.count <= maxValueBytes else {
            return failure(.valueTooLarge, 0, "Value exceeds the 16 KiB bound.")
        }
        lock.lock()
        defer { lock.unlock() }
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        var status = SecItemUpdate(base as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var add = base
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            status = SecItemAdd(add as CFDictionary, nil)
        }
        guard status == errSecSuccess else { return failure(.keychainOSStatus, status, "Keychain write failed.") }
        return success(nil)
    }

    public static func remove(_ requestedKey: String) -> String {
        if requestedKey != key { return failure(.invalidKey, 0, "Unsupported secure-storage key.") }
        lock.lock()
        defer { lock.unlock() }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
        ]
        let status = SecItemDelete(query as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound { return success(nil) }
        return failure(.keychainOSStatus, status, "Keychain removal failed.")
    }

    private static func success(_ value: String?) -> String {
        return envelope(ok: true, value: value, code: "", status: 0, message: "")
    }

    private static func failure(_ code: FailureCode, _ status: OSStatus, _ message: String) -> String {
        return envelope(ok: false, value: nil, code: code.rawValue, status: status, message: message)
    }

    private static func envelope(ok: Bool, value: String?, code: String, status: OSStatus, message: String) -> String {
        let object: [String: Any] = [
            "ok": ok,
            "value": value as Any? ?? NSNull(),
            "code": code,
            "osStatus": Int(status),
            "message": message,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: []),
              let json = String(data: data, encoding: .utf8) else {
            return "{\"ok\":false,\"value\":null,\"code\":\"envelope_failed\",\"osStatus\":0,\"message\":\"Secure-storage failure envelope could not be encoded.\"}"
        }
        return json
    }
}
