package com.hamtech.mobile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.firebase.messaging.FirebaseMessaging

class HamtechFcmTokenModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "HamtechFcmToken"

  @ReactMethod
  fun getToken(promise: Promise) {
    FirebaseMessaging.getInstance().token
        .addOnSuccessListener { token -> promise.resolve(token) }
        .addOnFailureListener { error ->
          promise.reject("FCM_TOKEN_ERROR", error.message, error)
        }
  }
}
