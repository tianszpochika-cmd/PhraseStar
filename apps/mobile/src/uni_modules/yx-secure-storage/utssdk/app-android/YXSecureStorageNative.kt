package uts.sdk.modules.yxSecureStorage

import android.content.Context
import android.os.Build
import android.system.Os
import android.system.OsConstants
import io.dcloud.uts.UTSAndroid
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileDescriptor
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Narrow Android implementation for exactly one refresh-token key.
 *
 * The AES key lives in AndroidKeyStore and is never exported. Only the GCM
 * ciphertext (with its provider-generated IV and authenticated header) is
 * written to a bounded file under noBackupFilesDir. No preferences, ordinary
 * uni storage, or plaintext file is used as a fallback.
 */
object YXSecureStorageNative {
    private const val KEY = "yx.auth.mobile.refresh-token"
    private const val KEY_ALIAS = "yx.auth.mobile.refresh-token.aes.v1"
    private const val DIR_NAME = "yx-secure-storage"
    private const val FILE_NAME = "refresh-token.bin"
    private const val TEMP_NAME = "refresh-token.bin.tmp"
    private const val MAX_VALUE_BYTES = 16 * 1024
    private const val HEADER_LEN = 18
    private const val MAX_FILE_BYTES = HEADER_LEN + MAX_VALUE_BYTES + 16
    private const val IV_LEN = 12
    private const val TAG_BITS = 128
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private val LOCK = Any()
    private val MAGIC = byteArrayOf(0x59, 0x58, 0x53, 0x54)
    private const val VERSION: Byte = 1

    private enum class FailureCode(val wire: String) {
        INVALID_KEY("invalid_key"),
        INVALID_VALUE("invalid_value"),
        VALUE_TOO_LARGE("value_too_large"),
        API_UNSUPPORTED("android_api_unsupported"),
        CONTEXT_UNAVAILABLE("context_unavailable"),
        STORAGE_UNAVAILABLE("storage_unavailable"),
        STORAGE_CORRUPT("storage_corrupt"),
        STORAGE_READ_FAILED("storage_read_failed"),
        STORAGE_WRITE_FAILED("storage_write_failed"),
        STORAGE_REMOVE_FAILED("storage_remove_failed"),
        KEY_UNAVAILABLE("key_unavailable"),
        CRYPTO_FAILED("crypto_failed"),
        ENCODING_INVALID("encoding_invalid"),
        IV_INVALID("iv_invalid"),
    }

    fun read(key: String): String = synchronized(LOCK) {
        if (key != KEY) return@synchronized failure(FailureCode.INVALID_KEY, 0, "Unsupported secure-storage key.")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return@synchronized failure(FailureCode.API_UNSUPPORTED, 0, "AndroidKeyStore AES-GCM requires API 23 or newer.")
        }
        val context = UTSAndroid.getAppContext() ?: return@synchronized failure(FailureCode.CONTEXT_UNAVAILABLE, 0, "Application context unavailable.")
        val dir = File(context.noBackupFilesDir, DIR_NAME)
        if (!dir.exists()) return@synchronized success(null)
        if (!dir.isDirectory) return@synchronized failure(FailureCode.STORAGE_UNAVAILABLE, 0, "No-backup storage path is not a directory.")
        val target = File(dir, FILE_NAME)
        if (!target.exists()) return@synchronized success(null)
        if (!target.isFile) return@synchronized failure(FailureCode.STORAGE_CORRUPT, 0, "Secure-storage entry is not a file.")
        val bytes = readBounded(target) ?: return@synchronized failure(FailureCode.STORAGE_READ_FAILED, 0, "Secure-storage entry could not be read safely.")
        if (bytes.size < HEADER_LEN + 16) return@synchronized failure(FailureCode.STORAGE_CORRUPT, 0, "Secure-storage entry is truncated.")
        if (bytes[0] != MAGIC[0] || bytes[1] != MAGIC[1] || bytes[2] != MAGIC[2] || bytes[3] != MAGIC[3] || bytes[4] != VERSION) {
            return@synchronized failure(FailureCode.STORAGE_CORRUPT, 0, "Secure-storage entry header is invalid.")
        }
        val ivLength = bytes[5].toInt() and 0xff
        if (ivLength != IV_LEN) return@synchronized failure(FailureCode.STORAGE_CORRUPT, 0, "Secure-storage IV length is invalid.")
        val header = bytes.copyOfRange(0, HEADER_LEN)
        val iv = bytes.copyOfRange(6, HEADER_LEN)
        val ciphertext = bytes.copyOfRange(HEADER_LEN, bytes.size)
        try {
            // Read/decrypt must never create a key or repair a missing slot.
            val secret = loadExistingKey() ?: return@synchronized failure(FailureCode.KEY_UNAVAILABLE, 0, "Keystore key is unavailable.")
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, secret, GCMParameterSpec(TAG_BITS, iv))
            cipher.updateAAD(header)
            val plain = cipher.doFinal(ciphertext)
            if (plain.size > MAX_VALUE_BYTES) return@synchronized failure(FailureCode.VALUE_TOO_LARGE, 0, "Stored value exceeds the bound.")
            val value = decodeUtf8(plain) ?: return@synchronized failure(FailureCode.ENCODING_INVALID, 0, "Stored value is not valid UTF-8.")
            return@synchronized success(value)
        } catch (error: Throwable) {
            return@synchronized failure(FailureCode.CRYPTO_FAILED, 0, "Authenticated decryption failed.")
        }
    }

    fun write(key: String, value: String): String = synchronized(LOCK) {
        if (key != KEY) return@synchronized failure(FailureCode.INVALID_KEY, 0, "Unsupported secure-storage key.")
        if (value.isEmpty()) return@synchronized failure(FailureCode.INVALID_VALUE, 0, "Refusing to store an empty value.")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return@synchronized failure(FailureCode.API_UNSUPPORTED, 0, "AndroidKeyStore AES-GCM requires API 23 or newer.")
        }
        val plain = value.toByteArray(StandardCharsets.UTF_8)
        if (plain.size > MAX_VALUE_BYTES) return@synchronized failure(FailureCode.VALUE_TOO_LARGE, 0, "Value exceeds the 16 KiB bound.")
        val context = UTSAndroid.getAppContext() ?: return@synchronized failure(FailureCode.CONTEXT_UNAVAILABLE, 0, "Application context unavailable.")
        val dir = File(context.noBackupFilesDir, DIR_NAME)
        if (dir.exists() && !dir.isDirectory) return@synchronized failure(FailureCode.STORAGE_UNAVAILABLE, 0, "No-backup storage path is not a directory.")
        if (!dir.exists() && !dir.mkdirs()) return@synchronized failure(FailureCode.STORAGE_UNAVAILABLE, 0, "No-backup storage directory could not be created.")
        try {
            // Only a write may create the Keystore key for the slot.
            val secret = loadOrCreateWriteKey()
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, secret)
            val iv = cipher.iv
            if (iv == null || iv.size != IV_LEN) return@synchronized failure(FailureCode.IV_INVALID, 0, "Provider did not return a 12-byte IV.")
            val header = ByteArray(HEADER_LEN)
            header[0] = MAGIC[0]
            header[1] = MAGIC[1]
            header[2] = MAGIC[2]
            header[3] = MAGIC[3]
            header[4] = VERSION
            header[5] = IV_LEN.toByte()
            System.arraycopy(iv, 0, header, 6, IV_LEN)
            cipher.updateAAD(header)
            val ciphertext = cipher.doFinal(plain)
            val encoded = ByteArray(HEADER_LEN + ciphertext.size)
            System.arraycopy(header, 0, encoded, 0, HEADER_LEN)
            System.arraycopy(ciphertext, 0, encoded, HEADER_LEN, ciphertext.size)
            writeAtomic(dir, encoded)
            return@synchronized success(null)
        } catch (error: Throwable) {
            return@synchronized failure(FailureCode.STORAGE_WRITE_FAILED, 0, "Encrypted storage write failed.")
        }
    }

    fun remove(key: String): String = synchronized(LOCK) {
        if (key != KEY) return@synchronized failure(FailureCode.INVALID_KEY, 0, "Unsupported secure-storage key.")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return@synchronized failure(FailureCode.API_UNSUPPORTED, 0, "AndroidKeyStore AES-GCM requires API 23 or newer.")
        }
        val context = UTSAndroid.getAppContext() ?: return@synchronized failure(FailureCode.CONTEXT_UNAVAILABLE, 0, "Application context unavailable.")
        val dir = File(context.noBackupFilesDir, DIR_NAME)
        if (!dir.exists()) return@synchronized success(null)
        if (!dir.isDirectory) return@synchronized failure(FailureCode.STORAGE_UNAVAILABLE, 0, "No-backup storage path is not a directory.")
        try {
            val target = File(dir, FILE_NAME)
            val temp = File(dir, TEMP_NAME)
            if (temp.exists() && !temp.delete()) return@synchronized failure(FailureCode.STORAGE_REMOVE_FAILED, 0, "Temporary entry could not be removed.")
            if (target.exists() && !target.delete()) return@synchronized failure(FailureCode.STORAGE_REMOVE_FAILED, 0, "Secure-storage entry could not be removed.")
            return@synchronized success(null)
        } catch (error: Throwable) {
            return@synchronized failure(FailureCode.STORAGE_REMOVE_FAILED, 0, "Secure-storage removal failed.")
        }
    }

    /** Existing-key lookup only. It must not generate or replace a key. */
    private fun loadExistingKey(): SecretKey? {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null as java.io.InputStream?, null as CharArray?)
        return keyStore.getKey(KEY_ALIAS, null) as? SecretKey
    }

    /** Write-only path: reuse the existing key or create it for this slot. */
    private fun loadOrCreateWriteKey(): SecretKey {
        loadExistingKey()?.let { return it }
        val generator = KeyGenerator.getInstance("AES", ANDROID_KEYSTORE)
        val spec = android.security.keystore.KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    private fun readBounded(file: File): ByteArray? {
        if (file.length() > MAX_FILE_BYTES.toLong()) return null
        return try {
            FileInputStream(file).use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                var total = 0
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    total += read
                    if (total > MAX_FILE_BYTES) return null
                    output.write(buffer, 0, read)
                }
                output.toByteArray()
            }
        } catch (error: Throwable) {
            null
        }
    }

    private fun writeAtomic(dir: File, bytes: ByteArray) {
        val target = File(dir, FILE_NAME)
        val temp = File(dir, TEMP_NAME)
        if (temp.exists() && !temp.delete()) throw IllegalStateException("stale temporary file")
        FileOutputStream(temp).use { output ->
            output.write(bytes)
            output.flush()
            output.fd.sync()
        }
        try {
            Os.rename(temp.absolutePath, target.absolutePath)
            try { Os.chmod(target.absolutePath, 384) } catch (_: Throwable) { }
            var dirFd: FileDescriptor? = null
            try {
                val opened = Os.open(dir.absolutePath, OsConstants.O_RDONLY, 0)
                dirFd = opened
                Os.fsync(opened)
            } catch (_: Throwable) {
            } finally {
                val opened = dirFd
                if (opened != null) try { Os.close(opened) } catch (_: Throwable) { }
            }
        } catch (error: Throwable) {
            temp.delete()
            throw error
        }
    }

    private fun decodeUtf8(bytes: ByteArray): String? = try {
        StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes))
            .toString()
    } catch (error: Throwable) {
        null
    }

    private fun success(value: String?): String {
        val json = JSONObject()
        json.put("ok", true)
        if (value == null) json.put("value", JSONObject.NULL) else json.put("value", value)
        json.put("code", "")
        json.put("osStatus", 0)
        json.put("message", "")
        return json.toString()
    }

    private fun failure(code: FailureCode, osStatus: Int, message: String): String {
        val json = JSONObject()
        json.put("ok", false)
        json.put("value", JSONObject.NULL)
        json.put("code", code.wire)
        json.put("osStatus", osStatus)
        json.put("message", message)
        return json.toString()
    }
}
