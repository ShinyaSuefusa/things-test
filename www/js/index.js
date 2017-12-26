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

angular.module('App', [])
.controller('AppController', function($scope) {
    var vm = this;
    var uart = null;
    var lcdpcf8574 = null;

    var display = null;
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
        uart.openUartDevice("USB1-1.2:1.0")
        .then(function(device) {
            console.log("uart open success");
            device.setBaudrate(900)
            .then(function() {
                console.log("uart set baudrate success");
            });
            device.setDataSize(8)
            .then(function() {
                console.log("uart set data size success");
            });
            device.setParity(uart.PARITY_NONE)
            .then(function() {
                console.log("uart set parity success");
            });
            device.setStopBits(1)
            .then(function() {
                console.log("uart set stop bits success");
            });
            var uartMode = 'ready';
            var uartBuffer = '';
            device.registerUartDeviceCallback(function() {
                device.read(1)
                .then(function(data) {
                    if (data.length) {
                        if (data[0] == 0x80) {
                            uartMode = 'ctrl';
                        } else if (uartMode == 'ctrl') {
                            if (data[0] == 0x00) {
                                uartMode = 'data';
                            } else if (data[0] == 0xFF) {
                                uartMode = 'ready';
                                var _buffer = uartBuffer;
                                $scope.$apply(function() {
                                    vm.onUartReceive(_buffer);
                                });
                            } else {
                                uartMode = 'ready';
                            }
                            uartBuffer = '';
                        }  else if (uartMode == 'data') {
                            uartBuffer += (uartBuffer.length != 0 ? ' ' : '') + ('0'+data[0].toString(16)).slice(-2).toUpperCase();
                        }
                    }
                });
            }, function() {
                console.log("uart register callback success");
            });
        });
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
    };

    vm.recvData = '';
});
