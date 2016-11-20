// This #include statement was automatically added by the Particle IDE.
#include "InternetButton/InternetButton.h"


InternetButton b = InternetButton();
int successLED = 1;
int INTERVAL = 25; // 255 / 10 intervals is approximately 25
int NUM_LIGHTS = 11;
int HALF_FLASH_PERIOD = 500;
int POLL_PERIOD = 30000; // Poll every 12 loops
int buttonProcessingDelay = 3000;
int statusProcessingDelay = 3000;
int successButton = 2;
int resetButton = 3;
int urgent = 0;
int failed = 0;
int pollCounter = 1;

void setup() {
    b.begin();
    // For response from server for button press
    Particle.subscribe("hook-response/buttonPress", buttonResponseHandler, MY_DEVICES);

    Particle.subscribe("hook-response/failureStatus", statusResponseHandler, MY_DEVICES);
}

void buttonResponseHandler(const char *event, const char *data) {
  // Handle the integration response
  //if (strcmp(data, "success") == 0) {
      //digitalWrite(successLED, HIGH); Board LED
      
      b.ledOn(successLED, 0, (successLED - 1) * INTERVAL, (NUM_LIGHTS -  (++successLED)) * INTERVAL); // success only registered if response received
      //successLED++;
  //}
}

void statusResponseHandler(const char *event, const char *data) {
    if (strcmp(data, "fail") == 0) {
        failed = 1;
        urgent = 0;
        showFailure();
    }
    if (strcmp(data, "urgent") == 0) {
        failed = 0;
        urgent = 1;
        flashYellow();
    }
    else if (strcmp(data, "good") == 0) {
        failed = 0;
        urgent = 0;
        turnOffLights(successLED);
    }
}


void turnOffLights(int startIndex) {
    for (int led = startIndex; led <= NUM_LIGHTS; led ++) {
        b.ledOff(led);
    }
}

void turnOffAllLights() {
    /*
    for (int led = 1; led <= NUM_LIGHTS; led ++) {
        b.ledOff(led);
    }
    */
    turnOffLights(1);
}


void flashGreen() {
    for (int led = 1; led <= NUM_LIGHTS; led ++) {
        b.ledOn(led, 0, 255, 0);
    }
    delay(HALF_FLASH_PERIOD);
    turnOffAllLights();
    delay(HALF_FLASH_PERIOD);
}

void resetContract() {
    successLED = 1;
    //urgent = 0;
    //failed = 0;
    //pollCounter = 1;
}

void getFailureStatus() {
    String data = String(successLED + 1);
    Particle.publish("failureStatus", data, PRIVATE);
    delay(statusProcessingDelay); // Wait 3 seconds
}


void showFailure() {
    for (int led = successLED; led <= NUM_LIGHTS; led ++) {
        b.ledOn(led, 255, 0, 0);
    }
}

void flashYellow() { // Contract expiring soon
    for (int led = successLED; led <= NUM_LIGHTS; led ++) {
        b.ledOn(led, 255, 255, 0);
    }
    //delay(HALF_FLASH_PERIOD);
    //turnOffLights(successLED);
    //delay(HALF_FLASH_PERIOD);
}

void poll() {
    if (pollCounter % POLL_PERIOD == 0) {
        pollCounter %= POLL_PERIOD;
        getFailureStatus();
    }
    pollCounter ++;
}

void loop() {
    if (successLED == NUM_LIGHTS) { // all lights turn green when successful
        flashGreen();
        if (b.buttonOn(resetButton)) {
            resetContract();
        }
    }
    if (failed) {
        //showFailure();
        if (b.buttonOn(resetButton)) {
            resetContract();
        }
        //pollCounter ++;
    }
    if (urgent) {
        flashYellow();
        //pollCounter ++;
        poll();
    }
// Get some data
    else { // new success button press only registered if user resets
      String data = String(successLED + 1);
      // Trigger the buttonPress event
      if (b.buttonOn(successButton)) {
        Particle.publish("buttonPress", data, PRIVATE);
        delay(buttonProcessingDelay);  // Wait 3 seconds
      }
      // Poll for status every POLL_PERIOD
    }
    poll();
}