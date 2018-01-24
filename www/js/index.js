/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    // Application Constructor
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function() {
        this.receivedEvent('deviceready');
    },

    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
};

app.initialize();

var bayerThresholdMap = [
  [  15, 135,  45, 165 ],
  [ 195,  75, 225, 105 ],
  [  60, 180,  30, 150 ],
  [ 240, 120, 210,  90 ]
];

var lumR = [];
var lumG = [];
var lumB = [];
for (var i=0; i<256; i++) {
  lumR[i] = i*0.299;
  lumG[i] = i*0.587;
  lumB[i] = i*0.114;
}

function actual(fore, alpha, back) {
    return Math.floor(back * (1 - alpha / 255) + fore * (alpha / 255));
}

function monochrome(imageData, threshold, bkColor, type, negative){

  var imageDataLength = imageData.data.length;
  var bkR = bkColor & 255;
  var bkG = (bkColor >> 8) & 255;
  var bkB = (bkColor >> 16) & 255;
  var on = negative ? 0 : 255;
  var off = negative ? 255 : 0;

  // Greyscale luminance (sets r pixels to luminance of rgb)
  for (var i = 0; i <= imageDataLength; i += 4) {
    var alpha = imageData.data[i+3];

    imageData.data[i] = Math.floor(lumR[actual(imageData.data[i], alpha, bkR)] + lumG[actual(imageData.data[i+1], alpha, bkG)] + lumB[actual(imageData.data[i+2], alpha, bkB)]);
  }

  var w = imageData.width;
  var newPixel, err;
  var data = new Array(imageDataLength / 4);

  for (var currentPixel = 0; currentPixel <= imageDataLength; currentPixel+=4) {

    if (type === "none") {
      // No dithering
      imageData.data[currentPixel] = imageData.data[currentPixel] < threshold ? off : on;
    } else if (type === "bayer") {
      // 4x4 Bayer ordered dithering algorithm
      var x = currentPixel/4 % w;
      var y = Math.floor(currentPixel/4 / w);
      var map = Math.floor( (imageData.data[currentPixel] + bayerThresholdMap[x%4][y%4]) / 2 );
      imageData.data[currentPixel] = (map < threshold) ? off : on;
    } else if (type === "floydsteinberg") {
      // Floyd–Steinberg dithering algorithm
      newPixel = imageData.data[currentPixel] < 129 ? off : on;
      err = Math.floor((imageData.data[currentPixel] - newPixel) / 16);
      imageData.data[currentPixel] = newPixel;

      imageData.data[currentPixel       + 4 ] += err*7;
      imageData.data[currentPixel + 4*w - 4 ] += err*3;
      imageData.data[currentPixel + 4*w     ] += err*5;
      imageData.data[currentPixel + 4*w + 4 ] += err*1;
    } else {
      // Bill Atkinson's dithering algorithm
      newPixel = imageData.data[currentPixel] < threshold ? off : on;
      err = Math.floor((imageData.data[currentPixel] - newPixel) / 8);
      imageData.data[currentPixel] = newPixel;

      imageData.data[currentPixel       + 4 ] += err;
      imageData.data[currentPixel       + 8 ] += err;
      imageData.data[currentPixel + 4*w - 4 ] += err;
      imageData.data[currentPixel + 4*w     ] += err;
      imageData.data[currentPixel + 4*w + 4 ] += err;
      imageData.data[currentPixel + 8*w     ] += err;
    }

    // Set g and b pixels equal to r
    imageData.data[currentPixel + 1] = imageData.data[currentPixel + 2] = imageData.data[currentPixel];
    // Set a is 100%
    imageData.data[currentPixel + 3] = 255;
    // Set data
    data[currentPixel / 4] = imageData.data[currentPixel];
  }

  return data;
}






angular.module('App', [])
.controller('AppController', function($scope, $interval, $timeout) {
    var vm = this;
    var uart = null;
    var gpio = null;
    var lcdpcf8574 = null;
    var ssd1306 = null;
    var keypad = null;
    var button = null;

    var display = null;
    var led16 = null;
    var led20 = null;
    var led21 = null;

    vm.led16 = false;
    vm.led20 = false;
    vm.led21 = false;
    document.addEventListener('deviceready', function() {
        $scope.$apply(function() {
            vm.onDeviceReady();
        });
    });
    vm.onDeviceReady = function() {
        uart = cordova.plugins.things.uart;
        uart.getUartDeviceList()
        .then(function(list) {
            console.log(list);
        });
        //uart.openUartDevice("UART0")
        //uart.openUartDevice("MINIUART")
        // uart.openUartDevice("USB1-1.2:1.0")
        // .then(function(device) {
        //     console.log("uart open success");
        //     device.setBaudrate(900)
        //     .then(function() {
        //         console.log("uart set baudrate success");
        //     });
        //     device.setDataSize(8)
        //     .then(function() {
        //         console.log("uart set data size success");
        //     });
        //     device.setParity(uart.PARITY_NONE)
        //     .then(function() {
        //         console.log("uart set parity success");
        //     });
        //     device.setStopBits(1)
        //     .then(function() {
        //         console.log("uart set stop bits success");
        //     });
        //     var uartMode = 'ready';
        //     var uartBuffer = '';
        //     device.registerUartDeviceCallback(function() {
        //         device.read(1)
        //         .then(function(data) {
        //             if (data.length) {
        //                 if (data[0] == 0x80) {
        //                     uartMode = 'ctrl';
        //                 } else if (uartMode == 'ctrl') {
        //                     if (data[0] == 0x00) {
        //                         uartMode = 'data';
        //                     } else if (data[0] == 0xFF) {
        //                         uartMode = 'ready';
        //                         var _buffer = uartBuffer;
        //                         $scope.$apply(function() {
        //                             vm.onUartReceive(_buffer);
        //                         });
        //                     } else {
        //                         uartMode = 'ready';
        //                     }
        //                     uartBuffer = '';
        //                 }  else if (uartMode == 'data') {
        //                     uartBuffer += (uartBuffer.length != 0 ? ' ' : '') + ('0'+data[0].toString(16)).slice(-2).toUpperCase();
        //                 }
        //             }
        //         });
        //     }, function() {
        //         console.log("uart register callback success");
        //     });
        // });
        gpio = cordova.plugins.things.gpio;
        gpio.openGpio("BCM16")
        .then(function(device) {
            console.log("gpio 16 open success");
            led16 = device;
        });
        gpio.openGpio("BCM20")
        .then(function(device) {
            console.log("gpio 20 open success");
            led20 = device;
        });
        gpio.openGpio("BCM21")
        .then(function(device) {
            console.log("gpio 21 open success");
            led21 = device;
        })
        lcdpcf8574 = cordova.plugins.things.lcdpcf8574;
        lcdpcf8574.open("I2C1", 0x27)//0x3f)
        .then(function(device) {
            console.log("lcdpcf8574 open success");
            device.begin(16, 2, 0);
            device.setBacklight(true);

            // load custom character to the LCD
            var heart = [0b00000, 0b01010, 0b11111, 0b11111, 0b11111, 0b01110, 0b00100, 0b00000];
            device.createChar(0, heart);

            device.clear();
            device.print("Hello, Monaca");
            device.write(0); // write :heart: custom character
            device.setCursor(0, 1);
            display = device;
        }, function(error) {
            console.log(error);
        });
        ssd1306 = cordova.plugins.things.ssd1306;
        ssd1306.open("I2C1")
        .then(function(device) {
            console.log("ssd1306 open success");
            device.clearPixels();
            device.show();

            var src = $('#src')[0];
            var dst = $('#dst')[0];

            var context = src.getContext('2d');
            var dstContext = dst.getContext('2d');

            // イメージを更新する
            var imageUpdate = function() {
                // ディザ変換！
                var img = context.getImageData(0, 0, 128, 64);
                var img2 = monochrome(img, 128, 0xFFFFFF, "bayer", true);

                // ディストに転送～
                dstContext.putImageData(img, 0, 0);

                // SSD1306に転送！！
                device.setPixels(img2);
                device.show();
            };
            // キャンバスをクリアする
            var clearCanvas = function() {
                context.clearRect(0, 0, src.width, src.height);
                dstContext.clearRect(0, 0, dst.width, dst.height);
                imageUpdate();
            };

            // ぴーぷるくんを描いてみる
            var drawPeoplekun = function() {
                clearCanvas();

                var pimg = new Image();
                pimg.src = "img/people.png";
                pimg.onload = function() {
                    context.drawImage(pimg, 0, 20, 128, 30);
                    imageUpdate();
                    $timeout(drawDroidkun, 5000);
                };
            };
            drawPeoplekun();

            // どろいどくんを描いてみる
            var drawDroidkun = function() {
                clearCanvas();

                var dimg = new Image();
                dimg.src = "img/droidkun1.png";
                dimg.onload = function() {
                    context.drawImage(dimg, 5, 5, 50, 60);
                    imageUpdate();
                    // ビットマップフォントロード
                    $.get('font/k8x12L.bdf', function (data) {
                        var font = new BDFFont(data);

                        context.fillStyle = 'rgb(0,0,0)';
                        
                        // 文字出力！
                        $timeout(function() {
                            font.drawText(context, "「OK, グーグル」", 55, 10);
                            imageUpdate();
                        }, 1000);
                        $timeout(function() {
                            font.drawText(context, "「今日の天気は？」", 55, 22);
                            imageUpdate();
                        }, 2000);
                        $timeout(function() {
                            font.drawText(context, "『知ラネー。』", 55, 34);
                            imageUpdate();
                        }, 3000);
                        $timeout(function() {
                            font.drawText(context, "『帰ルワ。』", 55, 46);
                            imageUpdate();
                        }, 4000);
                        $timeout(function() {
                            font.drawText(context, "「・・・」", 55, 58);
                            imageUpdate();
                        }, 5000);
                        $timeout(clearCanvas, 10000);
                    });
                };
            };
        });
        keypad = cordova.plugins.things.keypad;
        keypad.open("keypad", ["BCM18", "BCM23", "BCM24", "BCM25"], ["BCM6", "BCM13", "BCM19", "BCM26"],
            [8, 9, 10, 29, 11, 12, 13, 30, 14, 15, 16, 31, 17, 7, 18, 32])
        .then(function (device) {
            console.log("keypad open success");
            device.register();
        });
        button = cordova.plugins.things.button;
        button.open("BCM17", button.PRESSED_WHEN_LOW, 33)
        .then(function (device) {
            console.log("button1 open success");
            device.register();
            device.setDebounceDelay(0);
        });
        button.open("BCM27", button.PRESSED_WHEN_LOW, 34)
        .then(function (device) {
            console.log("button2 open success");
            device.register();
            device.setDebounceDelay(0);
        })
    };

    vm.onUartReceive = function(data) {
        var button = '';
        switch (data) {
        case '55 95 44 A5':
            button = 'CH-';
            break;
        case '55 A5 24 A5':
            button = 'CH';
            break;
        case '55 55 08 A5':
            button = 'CH+';
            break;
        case '55 45 52 A5':
            button = 'PREV';
            break;
        case '55 05 A9 A5':
            button = 'NEXT';
            break;
        case '55 55 84 A5':
            button = 'PLAY';
            break;
        case '55 55 00 55':
            button = 'VOL-';
            break;
        case '55 95 41 AA':
            button = 'VOL+';
            break;
        case '55 15 A0 55':
            button = 'EQ';
            break;
        case '55 A5 21 AA':
            button = '0';
            break;
        case '55 15 41 54':
            button = '100+';
            break;
        case '55 95 20 D5':
            button = '200+';
            break;
        case '55 45 50 55':
            button = '1';
            break;
        case '55 85 A8 AA':
            button = '2';
            break;
        case '55 A5 49 A4':
            button = '3';
            break;
        case '55 85 A8 55':
            button = '4';
            break;
        case '55 45 A1 54':
            button = '5';
            break;
        case '55 25 49 A4':
            button = '6';
            break;
        case '55 25 92 A5':
            button = '7';
            break;
        case '55 25 92 D2':
            button = '8';
            break;
        case '55 25 24 4A':
            button = '9';
            break;
        }
        if (button != '') {
            display.setCursor(0, 1);
            display.print(button+'     ');
        }
        if (button == '1') {
            vm.led16 = !vm.led16;
            led16.setValue(vm.led16 ? 1 : 0);
        }
        if (button == '2') {
            vm.led20 = !vm.led20;
            led20.setValue(vm.led20 ? 1 : 0);
        }
        if (button == '3') {
            vm.led21 = !vm.led21;
            led21.setValue(vm.led21 ? 1 : 0);
        }
        if (button == '4') {
            if (vm.interval) {
                $interval.cancel(vm.interval);
                vm.interval = null;
                vm.led16 = false;
                led16.setValue(0);
            } else {
                vm.interval = $interval(function() {
                    vm.led16 = !vm.led16;
                    led16.setValue(vm.led16 ? 1 : 0);
                }, 100);
            }
        }
    };

    vm.recvData = '';
    vm.interval = null;

    vm.onKeyPress = function ($event) {
        console.log("onKeyPress", $event);
        if ($event.key) {
            display.setCursor(0, 1);
            display.print('key '+$event.key+'    ');
        }
    };
});
