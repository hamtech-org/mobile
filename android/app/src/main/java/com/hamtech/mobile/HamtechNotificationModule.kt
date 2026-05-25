package com.hamtech.mobile

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs

class HamtechNotificationModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "HamtechNotifications"

  @ReactMethod
  fun showAvatarNotification(options: ReadableMap, promise: Promise) {
    try {
      if (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(reactContext, Manifest.permission.POST_NOTIFICATIONS) !=
          PackageManager.PERMISSION_GRANTED
      ) {
        Log.w(TAG, "showAvatarNotification: missing POST_NOTIFICATIONS permission")
        promise.resolve(false)
        return
      }

      val title = options.getStringOrNull("title") ?: ""
      val body = options.getStringOrNull("body") ?: ""
      val channelId = options.getStringOrNull("channelId") ?: "messages"
      val notificationId = options.getStringOrNull("notificationId") ?: "$channelId-${System.currentTimeMillis()}"
      val subtitle = options.getStringOrNull("subtitle")
      val data = options.getMap("data")
      val categoryIdentifier = data?.getStringOrNull("categoryIdentifier") ?: ""

      ensureChannel(channelId)

      val avatarBitmap = resolveAvatarBitmap(data)
      Log.i(
        TAG,
        "showAvatarNotification: title=$title, channelId=$channelId, category=$categoryIdentifier, avatar=${describeBitmap(avatarBitmap)}"
      )

      val intent = Intent(reactContext, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra("notificationId", notificationId)
        putExtra("route", data?.getStringOrNull("route"))
        putExtra("id", data?.getStringOrNull("id"))
        putExtra("entityId", data?.getStringOrNull("entityId"))
      }

      val pendingIntent =
        PendingIntent.getActivity(
          reactContext,
          abs(notificationId.hashCode()),
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

      val builder =
        NotificationCompat.Builder(reactContext, channelId)
          .setSmallIcon(R.drawable.notification_icon)
          .setContentTitle(title)
          .setContentText(body)
          .setContentIntent(pendingIntent)
          .setAutoCancel(channelId != "calls")
          .setOngoing(channelId == "calls")
          .setColor(0xFF0068FF.toInt())
          .setPriority(
            if (channelId == "calls") NotificationCompat.PRIORITY_MAX
            else NotificationCompat.PRIORITY_HIGH
          )
          .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)

      if (!subtitle.isNullOrBlank()) {
        builder.setSubText(subtitle)
      }

      if (categoryIdentifier == "hamtech_message") {
        val personBuilder = Person.Builder().setName(title.ifBlank { "Tin nhan moi" })
        if (avatarBitmap != null) {
          personBuilder.setIcon(IconCompat.createWithBitmap(avatarBitmap))
          builder.setLargeIcon(avatarBitmap)
        }
        val person = personBuilder.build()
        val style = NotificationCompat.MessagingStyle(person)
          .addMessage(body, System.currentTimeMillis(), person)
        if (!subtitle.isNullOrBlank()) {
          style.setConversationTitle(subtitle)
        }
        builder.setStyle(style)
      } else {
        if (avatarBitmap != null) {
          builder.setLargeIcon(avatarBitmap)
        }
        builder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
      }

      NotificationManagerCompat.from(reactContext).notify(abs(notificationId.hashCode()), builder.build())
      promise.resolve(true)
    } catch (error: Exception) {
      Log.e(TAG, "showAvatarNotification failed", error)
      promise.reject("HAMTECH_NOTIFICATION_ERROR", error.message, error)
    }
  }

  @ReactMethod
  fun dismissNotification(notificationId: String, promise: Promise) {
    try {
      NotificationManagerCompat.from(reactContext).cancel(abs(notificationId.hashCode()))
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("HAMTECH_NOTIFICATION_DISMISS_ERROR", error.message, error)
    }
  }

  private fun ensureChannel(channelId: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(channelId) != null) return
    val name =
      when (channelId) {
        "messages" -> "Tin nhan"
        "calls" -> "Cuoc goi"
        "social" -> "Hoat dong"
        else -> "Thong bao"
      }
    val importance =
      if (channelId == "calls") NotificationManager.IMPORTANCE_HIGH
      else NotificationManager.IMPORTANCE_DEFAULT
    manager.createNotificationChannel(NotificationChannel(channelId, name, importance))
  }

  private fun resolveAvatarBitmap(data: ReadableMap?): Bitmap? {
    if (data == null) return null

    val localUri = data.getStringOrNull("localAvatarUri")
    val localBitmap = decodeLocalBitmap(localUri)
    if (localBitmap != null) return localBitmap

    val avatarBase64 = data.getStringOrNull("avatarBase64")
    val base64Bitmap = decodeBase64Bitmap(avatarBase64)
    if (base64Bitmap != null) return base64Bitmap

    val remoteUrl =
      data.getStringOrNull("actorAvatar")
        ?: data.getStringOrNull("imageUrl")
        ?: data.getStringOrNull("senderAvatar")
    return downloadBitmap(remoteUrl)
  }

  private fun decodeLocalBitmap(localUri: String?): Bitmap? {
    if (localUri.isNullOrBlank()) return null
    return try {
      val path = Uri.parse(localUri).path ?: localUri
      val file = File(path)
      Log.i(TAG, "decodeLocalBitmap: path=$path, exists=${file.exists()}, length=${file.length()}")
      BitmapFactory.decodeFile(path).also {
        Log.i(TAG, "decodeLocalBitmap: bitmap=${describeBitmap(it)}")
      }
    } catch (error: Exception) {
      Log.e(TAG, "decodeLocalBitmap failed: $localUri", error)
      null
    }
  }

  private fun decodeBase64Bitmap(raw: String?): Bitmap? {
    if (raw.isNullOrBlank()) return null
    return try {
      val base64 = raw.substringAfter(",", raw)
      val bytes = Base64.decode(base64, Base64.DEFAULT)
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size).also {
        Log.i(TAG, "decodeBase64Bitmap: bitmap=${describeBitmap(it)}, length=${base64.length}")
      }
    } catch (error: Exception) {
      Log.e(TAG, "decodeBase64Bitmap failed", error)
      null
    }
  }

  private fun downloadBitmap(remoteUrl: String?): Bitmap? {
    if (remoteUrl.isNullOrBlank()) return null
    var connection: HttpURLConnection? = null
    return try {
      connection = URL(remoteUrl).openConnection() as HttpURLConnection
      connection.connectTimeout = 8000
      connection.readTimeout = 8000
      connection.doInput = true
      connection.connect()
      Log.i(TAG, "downloadBitmap: status=${connection.responseCode}")
      BitmapFactory.decodeStream(connection.inputStream).also {
        Log.i(TAG, "downloadBitmap: bitmap=${describeBitmap(it)}")
      }
    } catch (error: Exception) {
      Log.e(TAG, "downloadBitmap failed", error)
      null
    } finally {
      connection?.disconnect()
    }
  }

  private fun ReadableMap.getStringOrNull(key: String): String? {
    if (!hasKey(key) || isNull(key)) return null
    return getString(key)?.trim()?.takeIf { it.isNotEmpty() }
  }

  private fun describeBitmap(bitmap: Bitmap?): String =
    if (bitmap == null) "null" else "${bitmap.width}x${bitmap.height}"

  companion object {
    private const val TAG = "HamtechNativeNotif"
  }
}
