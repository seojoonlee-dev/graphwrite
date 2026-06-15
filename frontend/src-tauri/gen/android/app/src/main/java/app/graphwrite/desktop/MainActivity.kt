package app.graphwrite.desktop

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    // The WebView fires Android's built-in long-press haptic feedback regardless
    // of our in-app vibration setting. Disable it so the setting fully controls
    // haptics (our explicit vibration goes through the vibrator directly and is
    // unaffected).
    webView.isHapticFeedbackEnabled = false
  }
}
