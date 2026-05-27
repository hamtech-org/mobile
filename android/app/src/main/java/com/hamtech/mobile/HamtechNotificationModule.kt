package com.hamtech.mobile

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioAttributes
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
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs

class HamtechNotificationModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  init {
    HamtechNotificationActionBridge.attach(reactContext)
  }

  override fun getName(): String = "HamtechNotifications"

  override fun getConstants(): MutableMap<String, Any> =
    mutableMapOf("USER_TEXT_KEY" to USER_TEXT_KEY)

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter
  }

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
      val dataJson = readableMapToJsonObject(data)
      HamtechNotificationActionBridge.storePayload(notificationId, dataJson)

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
          .setDefaults(
            if (channelId == "calls") NotificationCompat.DEFAULT_VIBRATE
            else NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE
          )

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
        if (!subtitle.isNullOrBlank()) {
          style.setConversationTitle(subtitle)
        }
        val lines = parseMessagingLines(data).take(3)
        val stackFooter = data?.getStringOrNull("stackFooter")
        if (lines.isEmpty()) {
          style.addMessage(body, System.currentTimeMillis(), person)
        } else {
          for (line in lines) {
            val linePerson =
              if (!line.senderName.isNullOrBlank()) {
                Person.Builder().setName(line.senderName).build()
              } else {
                person
              }
            style.addMessage(line.text, line.timestamp, linePerson)
          }
          if (!stackFooter.isNullOrBlank()) {
            style.addMessage(stackFooter, System.currentTimeMillis(), person)
          }
        }
        val messageCount = data?.getNumberOrNull("messageCount")?.toInt() ?: lines.size
        if (messageCount > 1) {
          builder.setNumber(messageCount)
        }
        builder.setContentText(
          when {
            !stackFooter.isNullOrBlank() -> stackFooter
            messageCount > 1 -> "$messageCount tin nhắn mới"
            else -> body
          }
        )
        builder.setStyle(style)
      } else {
        if (avatarBitmap != null) {
          builder.setLargeIcon(avatarBitmap)
        }
        builder.setStyle(NotificationCompat.BigTextStyle().bigText(body))
      }

      addCategoryActions(builder, categoryIdentifier, notificationId)

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
    if (channelId != "calls" && manager.getNotificationChannel(channelId) != null) return

    val name =
      when (channelId) {
        "messages" -> "Tin nhan"
        "calls" -> "Cuoc goi"
        "social" -> "Hoat dong"
        else -> "Thong bao"
      }

    if (channelId == "calls") {
      manager.deleteNotificationChannel("calls")
      val channel =
        NotificationChannel("calls", name, NotificationManager.IMPORTANCE_HIGH).apply {
          val ringtoneAttrs =
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          setSound(
            Uri.parse("android.resource://${reactContext.packageName}/${R.raw.amthanhnhan}"),
            ringtoneAttrs,
          )
          enableVibration(true)
          vibrationPattern = longArrayOf(0, 400, 200, 400)
        }
      manager.createNotificationChannel(channel)
      return
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

  private data class NativeActionDef(
    val id: String,
    val title: String,
    val hasTextInput: Boolean = false,
  )

  private fun addCategoryActions(
    builder: NotificationCompat.Builder,
    categoryIdentifier: String,
    notificationId: String,
  ) {
    val actions = actionsForCategory(categoryIdentifier)
    for (action in actions) {
      if (action.hasTextInput) {
        builder.addAction(buildTextInputAction(action, notificationId))
      } else {
        builder.addAction(buildButtonAction(action, notificationId))
      }
    }
  }

  private fun actionsForCategory(categoryIdentifier: String): List<NativeActionDef> =
    when (categoryIdentifier) {
      "hamtech_message" ->
        listOf(
          NativeActionDef("reply", "Trả lời", hasTextInput = true),
          NativeActionDef("mute_1m", "Tắt 1 phút"),
        )
      "hamtech_call_direct", "hamtech_call_group" ->
        listOf(
          NativeActionDef("decline", "Từ chối"),
          NativeActionDef("answer", "Trả lời"),
        )
      "hamtech_call_missed" ->
        listOf(
          NativeActionDef("message", "Nhắn tin"),
          NativeActionDef("callback", "Gọi lại"),
        )
      "hamtech_social_friend" ->
        listOf(
          NativeActionDef("friend_decline", "Từ chối"),
          NativeActionDef("accept", "Chấp nhận"),
        )
      "hamtech_social_view", "hamtech_social" ->
        listOf(NativeActionDef("view", "Xem"))
      else -> emptyList()
    }

  private fun buildButtonAction(action: NativeActionDef, notificationId: String): NotificationCompat.Action {
    val pending = createActionPendingIntent(notificationId, action.id, false)
    return NotificationCompat.Action.Builder(null, action.title, pending).build()
  }

  private fun buildTextInputAction(
    action: NativeActionDef,
    notificationId: String,
  ): NotificationCompat.Action {
    val pending = createActionPendingIntent(notificationId, action.id, true)
    val remoteInput =
      RemoteInput.Builder(USER_TEXT_KEY).setLabel("Nhập tin nhắn...").build()
    return NotificationCompat.Action.Builder(null, action.title, pending)
      .addRemoteInput(remoteInput)
      .build()
  }

  private fun createActionPendingIntent(
    notificationId: String,
    actionId: String,
    withRemoteInput: Boolean,
  ): PendingIntent {
    val intent =
      Intent(reactContext, HamtechNotificationActionReceiver::class.java).apply {
        putExtra(HamtechNotificationActionReceiver.EXTRA_ACTION_ID, actionId)
        putExtra(HamtechNotificationActionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
      }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    return PendingIntent.getBroadcast(
      reactContext,
      (notificationId + actionId).hashCode(),
      intent,
      flags,
    )
  }

  private fun readableMapToJsonObject(map: ReadableMap?): org.json.JSONObject? {
    if (map == null) return null
    val obj = org.json.JSONObject()
    val iterator = map.entryIterator
    while (iterator.hasNext()) {
      val entry = iterator.next()
      when (entry.value) {
        is String -> obj.put(entry.key, entry.value)
        is Int -> obj.put(entry.key, entry.value)
        is Double -> obj.put(entry.key, entry.value)
        is Boolean -> obj.put(entry.key, entry.value)
      }
    }
    return obj
  }

  private data class MessagingLine(val text: String, val timestamp: Long, val senderName: String?)

  private fun parseMessagingLines(data: ReadableMap?): List<MessagingLine> {
    if (data == null || !data.hasKey("messagingLines") || data.isNull("messagingLines")) {
      return emptyList()
    }
    val raw = data.getArray("messagingLines") ?: return emptyList()
    val lines = mutableListOf<MessagingLine>()
    for (i in 0 until raw.size()) {
      if (raw.getType(i) != ReadableType.Map) continue
      val row = raw.getMap(i) ?: continue
      val text = row.getStringOrNull("text") ?: continue
      val timestamp =
        when {
          row.hasKey("timestamp") && !row.isNull("timestamp") ->
            row.getDouble("timestamp").toLong()
          else -> System.currentTimeMillis()
        }
      lines.add(MessagingLine(text, timestamp, row.getStringOrNull("senderName")))
    }
    return lines
  }

  private fun ReadableMap.getStringOrNull(key: String): String? {
    if (!hasKey(key) || isNull(key)) return null
    return getString(key)?.trim()?.takeIf { it.isNotEmpty() }
  }

  private fun ReadableMap.getNumberOrNull(key: String): Double? {
    if (!hasKey(key) || isNull(key)) return null
    return try {
      getDouble(key)
    } catch (_: Exception) {
      null
    }
  }

  private fun describeBitmap(bitmap: Bitmap?): String =
    if (bitmap == null) "null" else "${bitmap.width}x${bitmap.height}"

  companion object {
    private const val TAG = "HamtechNativeNotif"
    const val USER_TEXT_KEY = "hamtech_reply_text"
  }
}
