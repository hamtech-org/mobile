package com.hamtech.mobile

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

object HamtechNotificationActionBridge {
  private const val TAG = "HamtechNotifAction"
  private const val PREFS = "hamtech_notification_actions"
  private const val PENDING_KEY = "pending_json"

  private val payloadStore = ConcurrentHashMap<String, JSONObject>()
  private var reactContext: ReactApplicationContext? = null

  fun attach(context: ReactApplicationContext) {
    reactContext = context
    drainPending(context)
  }

  fun storePayload(notificationId: String, data: JSONObject?) {
    if (data != null) {
      payloadStore[notificationId] = data
    }
  }

  fun payloadFor(notificationId: String): JSONObject? = payloadStore[notificationId]

  fun deliver(
    context: Context,
    actionId: String,
    notificationId: String,
    userText: String?,
  ) {
    val data = payloadStore[notificationId] ?: JSONObject()
    val payload = Arguments.createMap().apply {
      putString("actionIdentifier", actionId)
      putString("notificationId", notificationId)
      if (!userText.isNullOrBlank()) putString("userText", userText)
      putMap("data", jsonToWritableMap(data))
    }

    val ctx = reactContext
    if (ctx != null && ctx.hasActiveReactInstance()) {
      emit(ctx, payload)
    } else {
      queuePending(context, payload)
      Log.i(TAG, "queued action=$actionId notificationId=$notificationId")
    }
  }

  private fun emit(ctx: ReactApplicationContext, payload: WritableMap) {
    try {
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onNotificationAction", payload)
    } catch (error: Exception) {
      Log.e(TAG, "emit failed", error)
    }
  }

  private fun queuePending(context: Context, payload: WritableMap) {
    try {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val arr = org.json.JSONArray(prefs.getString(PENDING_KEY, "[]"))
      val obj = JSONObject()
      obj.put("actionIdentifier", payload.getString("actionIdentifier"))
      obj.put("notificationId", payload.getString("notificationId"))
      if (payload.hasKey("userText")) obj.put("userText", payload.getString("userText"))
      val dataMap = payload.getMap("data")
      if (dataMap != null) {
        obj.put("data", writableMapToJson(dataMap))
      }
      arr.put(obj)
      prefs.edit().putString(PENDING_KEY, arr.toString()).apply()
    } catch (error: Exception) {
      Log.e(TAG, "queuePending failed", error)
    }
  }

  private fun writableMapToJson(map: com.facebook.react.bridge.ReadableMap): JSONObject {
    val obj = JSONObject()
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

  private fun drainPending(context: ReactApplicationContext) {
    try {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val raw = prefs.getString(PENDING_KEY, "[]") ?: "[]"
      val arr = org.json.JSONArray(raw)
      if (arr.length() == 0) return
      prefs.edit().remove(PENDING_KEY).apply()
      for (i in 0 until arr.length()) {
        val obj = arr.getJSONObject(i)
        val payload = Arguments.createMap().apply {
          putString("actionIdentifier", obj.optString("actionIdentifier"))
          putString("notificationId", obj.optString("notificationId"))
          val userText = obj.optString("userText", "")
          if (userText.isNotBlank()) putString("userText", userText)
          val dataObj = obj.optJSONObject("data") ?: JSONObject()
          putMap("data", jsonToWritableMap(dataObj))
        }
        emit(context, payload)
      }
    } catch (error: Exception) {
      Log.e(TAG, "drainPending failed", error)
    }
  }

  private fun jsonToWritableMap(json: JSONObject): WritableMap {
    val map = Arguments.createMap()
    val keys = json.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      when (val value = json.get(key)) {
        is String -> map.putString(key, value)
        is Int -> map.putInt(key, value)
        is Long -> map.putDouble(key, value.toDouble())
        is Double -> map.putDouble(key, value)
        is Boolean -> map.putBoolean(key, value)
        is JSONObject -> map.putMap(key, jsonToWritableMap(value))
      }
    }
    return map
  }
}
