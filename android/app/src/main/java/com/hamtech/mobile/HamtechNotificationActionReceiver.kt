package com.hamtech.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput

class HamtechNotificationActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val actionId = intent.getStringExtra(EXTRA_ACTION_ID) ?: return
    val notificationId = intent.getStringExtra(EXTRA_NOTIFICATION_ID) ?: return
    val userText =
      RemoteInput.getResultsFromIntent(intent)?.getString(HamtechNotificationModule.USER_TEXT_KEY)
        ?: RemoteInput.getResultsFromIntent(intent)?.getCharSequence(HamtechNotificationModule.USER_TEXT_KEY)?.toString()
    HamtechNotificationActionBridge.deliver(context, actionId, notificationId, userText)
  }

  companion object {
    const val EXTRA_ACTION_ID = "hamtech_action_id"
    const val EXTRA_NOTIFICATION_ID = "hamtech_notification_id"
  }
}
