package app.intouch.demo;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(CalendarMeetupsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
