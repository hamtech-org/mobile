package com.hamtech.mobile

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import com.amplifyframework.auth.cognito.AWSCognitoAuthPlugin
import com.amplifyframework.core.Amplify
import com.amplifyframework.ui.liveness.ui.FaceLivenessDetector
import com.amplifyframework.ui.liveness.ui.LivenessColorScheme

class HamtechFaceLivenessActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val sessionId = intent.getStringExtra(EXTRA_SESSION_ID)?.trim().orEmpty()
    val region = intent.getStringExtra(EXTRA_REGION)?.trim().orEmpty()
    if (sessionId.isEmpty() || region.isEmpty()) {
      finishWithError("Thiếu sessionId hoặc region cho Face Liveness.")
      return
    }

    configureAmplifyIfNeeded()

    setContent {
      MaterialTheme(colorScheme = LivenessColorScheme.default()) {
        FaceLivenessDetector(
            sessionId = sessionId,
            region = region,
            onComplete = {
              setResult(Activity.RESULT_OK)
              finish()
            },
            onError = { error ->
              Log.e(TAG, "Face Liveness failed: ${error.javaClass.simpleName}: ${error.message}")
              if (error.javaClass.simpleName.contains("UserCancelled", ignoreCase = true)) {
                setResult(RESULT_CANCELLED)
                finish()
              } else {
                finishWithError(error.message ?: "Face Liveness thất bại.")
              }
            })
      }
    }
  }

  private fun configureAmplifyIfNeeded() {
    if (amplifyConfigured) return

    try {
      Amplify.addPlugin(AWSCognitoAuthPlugin())
    } catch (_: Exception) {
      // Plugin có thể đã được add ở lần mở trước trong cùng process.
    }

    try {
      Amplify.configure(applicationContext)
      amplifyConfigured = true
    } catch (error: Exception) {
      if (error.javaClass.simpleName.contains("AlreadyConfigured", ignoreCase = true)) {
        amplifyConfigured = true
        return
      }
      Log.w(TAG, "Amplify configure skipped/failed: ${error.javaClass.simpleName}: ${error.message}")
    }
  }

  private fun finishWithError(message: String) {
    setResult(
        RESULT_ERROR,
        Intent().apply {
          putExtra(EXTRA_ERROR_MESSAGE, message)
        })
    finish()
  }

  companion object {
    private const val TAG = "HamtechFaceLiveness"
    const val EXTRA_SESSION_ID = "sessionId"
    const val EXTRA_REGION = "region"
    const val EXTRA_ERROR_MESSAGE = "errorMessage"
    const val RESULT_CANCELLED = Activity.RESULT_CANCELED
    const val RESULT_ERROR = Activity.RESULT_FIRST_USER + 1
    private var amplifyConfigured = false
  }
}
