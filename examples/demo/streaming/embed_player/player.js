let srctf="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"
let srcsd="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"

const SESSION_STATUS = Flashphoner.constants.SESSION_STATUS;
const STREAM_STATUS = Flashphoner.constants.STREAM_STATUS;
const STREAM_EVENT = Flashphoner.constants.STREAM_EVENT;
const STREAM_EVENT_TYPE = Flashphoner.constants.STREAM_EVENT_TYPE;
const PRELOADER_URL = "../../dependencies/media/preloader.mp4";
const Browser = Flashphoner.Browser;
let remoteVideo;
let playingStream;
let isStopped = true;

let autoplay = eval(getUrlParam("autoplay")) || false;
let resolution = getUrlParam("resolution");
let mediaProviders = getUrlParam("mediaProviders") || "";
// let streamName = getUrlParam("streamName") || "streamName";
//let urlServer = getUrlParam("urlServer") || setURL();
// let streamName = "rtsp://admin:123456@tc-mega254-1.kddns.info:5544/chID=2&streamType=main"
// let streamName = "rtsp://admin:123456@tc-mega254-1.kddns.info:5544/chID=5&streamType=sub"

//let urlServer = "wss://demo.flashphoner.com:8443";
let streamName = "rtsp://admin:a-123456@192.168.10.7:554/cam/realmonitor?channel=1%26subtype=0"
let urlServer = "wss://flashphoner.ezplus.com.tw:8443";

// Will always use a standard video controls
let useVideoControls = false;

// 新增 ----- block1 --- for tensorflow

const boxid = "img-box";
let liveView = undefined;
let _ratio = undefined;
let _vedio = undefined;

let children = [];
let session = undefined
let model =undefined;

let videoHeight = 0;
let videoWidth = 0;
let clientHeight = 0;
let clientWidth = 0;



// 新增 ----- block2 --- for canvas

var canvas;
var canvStream;
var localVideo;
var predictStreaming;

// video controls
let playerControl;
let fullscreen;
let playButton;
let mute;
let playerSound;


function init_page() {
    //init api
    try {
        Flashphoner.init({ preferredMediaProviders: mediaProviders && mediaProviders !== "" ? mediaProviders.split(','): [] });
        if (Flashphoner.getMediaProviders()[0] == "WSPlayer") {
            throw new Error("The WSPlayer mediaProvider is deprecated");
        }

    } catch(e) {
        document.getElementById("status").innerHTML = e.message;
        hideItem('preloader');
        centralButton.hide();
        return;
    }

    // Save video display element
    remoteVideo = document.getElementById("remoteVideo");
    canvas = document.getElementById("canvas");

    // control
    playerControl = document.getElementById('playControls');
    fullscreen    = document.getElementById("fullscreenButton");
    playButton    = document.getElementById("playButton");
    mute          = document.getElementById("mute");
    playerSound   = playerControl.querySelectorAll(".player-sound");

    //canvStream = createCanvasStream();
    // Init page elements
    onStopped();

    // Start playback if autoplay required
    if (autoplay) {
        centralButton.click();
        playButton.innerHTML = '❚❚';
    }
}

function onStarted() {
    isStopped = false;
    centralButton.prepareToStop();
    playButton.innerHTML = '❚❚';
}

function onStopped() {
    isStopped = true;
    hideItem('preloader');
    centralButton.prepareToStart(playBtnClick);
}

function playBtnClick() {
    if (isStopped) {
        centralButton.hide();
        start();
    } else {
        if (playingStream) {
            playingStream.stop();
        }
    }
}

function start() {
    if (!Browser.isChrome()) {
        // Display the custom preloader in non-Chromium browser
        showItem('preloader');
    }
    if (Browser.isSafari()) {
        Flashphoner.playFirstVideo(remoteVideo, false, PRELOADER_URL, useVideoControls).then(function() {
            createSession();
        }).catch(function() {
            onStopped();
        });
        return;
    }
    createSession();
}

function createSession() {
    //check if we already have session
    if (Flashphoner.getSessions().length > 0) {
        session = Flashphoner.getSessions()[0];
        playStream(session);
        return;
    }
    // In Chromium browsers we need a custom preloader for a new session only
    showItem('preloader');
    //create session
    console.log("Create new session with url " + urlServer);
    let mediaOptions = {"iceServers": [{'url': 'turn:turn.flashphoner.com:443?transport=tcp', 'username': 'flashphoner', 'credential': 'coM77EMrV7Cwhyan'}]};
    Flashphoner.createSession({urlServer: urlServer, mediaOptions: mediaOptions}).on(SESSION_STATUS.ESTABLISHED, function (session) {
        setStatus(session.status());
        //session connected, start playback
        playStream(session);
    }).on(SESSION_STATUS.DISCONNECTED, function () {
        setStatus(SESSION_STATUS.DISCONNECTED);
        onStopped();
    }).on(SESSION_STATUS.FAILED, function () {
        setStatus(SESSION_STATUS.FAILED);
        onStopped();
    });
}

function playStream(session) {
    let playWidth = 0;
    let platHeight = 0;
    let options = {
        name: streamName,
        display: remoteVideo,
        useControls: useVideoControls
    };
    if (resolution) {
        playWidth = resolution.split("x")[0];
        playHeight = resolution.split("x")[1];
        options.constraints = {
            video: {
                width: playWidth,
                height: playHeight
            },
            audio: true
        };
    }
    if (autoplay) {
        options.unmutePlayOnStart = false;
    }
    playingStream = session.createStream(options).on(STREAM_STATUS.PENDING, function (stream) {
        if (Browser.isChrome()) {
            // Hide a custom preloader in Chrome because there is a standard one with standard controls
            hideItem('preloader');
        }
        let video = document.getElementById(stream.id());

        // console.log(video)
        // video.onfullscreen = function fullScreen(event) {
        //     let elem = event.target;
        //     console.log(remoteVideo,elem)
        //     if(!document.webkitFullscreenElement) {
        //         remoteVideo.webkitRequestFullScreen();
        //     } else {
        //         document.webkitExitFullscreen();
        //     }
        // }

        if (!video.hasListeners) {
            video.hasListeners = true;

            // control事件
            setPlayEvent(video);

            // stream是flashphoner回傳給網頁的rtsp串流物件, stream.id()則是當前網頁播放的元件id
            // stream.id() 是 flashphoner 新增的元件 <video id="remoteVedio" video>
            setResizeHandler(video, stream, playWidth); //新增 resize 的事件
            remoteVideo.appendChild(createImgBox());
            if (Browser.isSafariWebRTC()) {
                setWebkitEventHandlers(video);
            } else {
                setEventHandlers(video);
            }
        //    remoteVideo.srcObj = stream;
        //    video.addEventListener('loadeddata', predictWebcam);
        }
    }).on(STREAM_STATUS.PLAYING, function (stream) {
        // Android Firefox may pause stream playback via MSE even if video element is muted
        if (Flashphoner.getMediaProviders()[0] == "MSE" && autoplay && Browser.isAndroidFirefox()) {
            let video = document.getElementById(stream.id());
            if (video && video.paused) {
                console.log('video play logging  <-->')
                video.play();
            }
        }
        setStatus(STREAM_STATUS.PLAYING);
        onStarted();
    }).on(STREAM_STATUS.STOPPED, function () {
        setStatus(STREAM_STATUS.STOPPED);
        onStopped();
    }).on(STREAM_STATUS.FAILED, function(stream) {
        setStatus(STREAM_STATUS.FAILED, stream);
        onStopped();
    }).on(STREAM_EVENT, function(streamEvent){
        if (STREAM_EVENT_TYPE.NOT_ENOUGH_BANDWIDTH === streamEvent.type) {
            let info = streamEvent.payload.info.split("/");
            let remoteBitrate = info[0];
            let networkBandwidth = info[1];
            console.log("Not enough bandwidth, consider using lower video resolution or bitrate. Bandwidth " + (Math.round(networkBandwidth / 1000)) + " bitrate " + (Math.round(remoteBitrate / 1000)));
        } else if (STREAM_EVENT_TYPE.RESIZE === streamEvent.type) {
            console.log("New video size: " + streamEvent.payload.streamerVideoWidth + "x" + streamEvent.payload.streamerVideoHeight);
        }else if(STREAM_EVENT_TYPE.SNAPSHOT_COMPLETED === streamEvent.type){
            console.log("Vedio event(snapshot completed)");
        }
        
    }).on(STREAM_EVENT_TYPE.DATA, function(stream){
        console.log("Vedio event(data)" + stream);
    }).on(STREAM_EVENT_TYPE.SNAPSHOT_COMPLETED, function(stream){
        console.log("Vedio event(snapshot completed)" + stream);
    });
    playingStream.play();
}

//show connection or remote stream status
function setStatus(status, stream) {
    let statusField = document.getElementById("status");
    if (status == "PLAYING" || status == "ESTABLISHED" || status == "STOPPED") {
        //don't display status word because we have this indication on UI
        statusField.innerHTML = "";
    } else if (status == "DISCONNECTED") {
        statusField.innerHTML = status;
    } else if (status == "FAILED") {
        statusField.innerHTML = status;
        if (stream && stream.getInfo() !== "") {
            statusField.innerHTML = status + ": " + stream.getInfo();
        }
    }
}

// Resize event handler
function setResizeHandler(video, stream, playWidth) {
    video.addEventListener('resize', function (event) {
        let streamResolution = stream.videoResolution();
        if (Object.keys(streamResolution).length === 0) {
            resizeVideo(event.target);
        } else {
            // Change aspect ratio to prevent video stretching
            let ratio = streamResolution.width / streamResolution.height;
            let newHeight = Math.floor(playWidth / ratio);
            resizeVideo(event.target, playWidth, newHeight);            
        }
    });
}

// iOS/MacOS handlers for fullscreen issues
function setWebkitEventHandlers(video) {
    let needRestart = false;
    let isFullscreen = false;
    // Hide custom preloader
    video.addEventListener('playing', function () {
        hideItem('preloader');
    });
    // Use webkitbeginfullscreen event to detect full screen mode in iOS Safari
    video.addEventListener("webkitbeginfullscreen", function () {
        isFullscreen = true;
    });                
    video.addEventListener("pause", function () {
        if (needRestart) {
            console.log("Video paused after fullscreen, continue...");
            video.play();
            needRestart = false;
        } else if (!(isFullscreen || document.webkitFullscreenElement)) {
            // Stop stream by standard play/pause control
            playingStream.stop();
        }
    });
    video.addEventListener("webkitendfullscreen", function () {
        video.play();
        needRestart = true;
        isFullscreen = false;
    });                
}

function setEventHandlers(video) {
    // Hide custom preloader
    video.addEventListener('playing', function () {
        hideItem('preloader');
    });
    // Use standard pause control to stop playback
    video.addEventListener("pause", function () {
        if (!(document.fullscreenElement || document.mozFullscreenElement)) {
            // Stop stream by standard play/pause control if we're not in fullscreen
            playingStream.stop();
        }
    });

    video.addEventListener("webkitbeginfullscreen", function (event) {
        console.log(event)
        // // isFullscreen = true;
        // remoteVideo2 = document.getElementById("remoteVideo");
        // remoteVideo2.webkitRequestFullScreen();
    }); 

    video.addEventListener('loadeddata', async function(){
        console.log("Wait to load detector model ---- >");

        cocoSsd.load({base: 'lite_mobilenet_v2'}).then(function (loadedModel) {
            model = loadedModel;
            console.log('predicting vedio streaming with + model' + '------>');
            _vedio = video;
            predictIframe();
          });
        
        // console.log(cocoSsd)
        // await cocoSsd.load({
        //     base: 'lite_mobilenet_v2', 
        //     // modelUrl: 'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json'
        //     // modelUrl: 'https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/model.json'
        //     // modelUrl: 'https://raw.githubusercontent.com/CAipswnx/test/main/test6/model.json'
        // }).then(function (loadedModel) {
        //     console.log(loadedModel);
        //     model = loadedModel;
        //     console.log('predicting vedio streaming with + model' + '------>');
        //     _vedio = video;
        //     predictIframe();
        //   });

    });
    
}

// Object to manage central Play/Stop button
const centralButton = {
    timer: null,
    displayed: false,
    display: function(timeout = 0) {
        showItem('play');
        centralButton.displayed = true;
        if (timeout > 0 && !centralButton.timer) {
            centralButton.timer = setTimeout(function() {
                centralButton.hide();
            }, timeout);
        }
    },
    displayToggle: function(timeout) {
        if(!centralButton.displayed) {
            centralButton.display(timeout);
        } else {
            centralButton.hide();
        }
    },
    setAction: function(action) {
        document.getElementById('play').onclick = action;
    },
    setView: function(view) {
        let button = document.getElementById('play');
        let image = button.querySelector('img');
        if (view === "play") {
            button.classList.remove('stop');
            button.classList.add('play');
            image.src = 'images/play.png';
        } else if (view === "stop") {
            button.classList.remove('play');
            button.classList.add('stop');
            image.src = 'images/stop.png';
        }
    },
    hide: function() {
        hideItem('play');
        centralButton.displayed = false;
        centralButton.stopTimer();
    },
    stopTimer: function() {
        if (centralButton.timer) {
            clearTimeout(centralButton.timer);
            centralButton.timer = null;
        }
    },
    click: function() {
        document.getElementById('play').click();
    },
    prepareToStart: function(action) {
        centralButton.stopTimer();
        centralButton.setView("play");
        centralButton.display();
        centralButton.setAction(action);   
    },
    prepareToStop: function() {
        centralButton.setView("stop");
        centralButton.hide();
    }
};

// Helper functions to display/hide an element
function showItem(id) {
    let item = document.getElementById(id);
    if (item) {
        item.style.display = "block";
    }
}

function hideItem(id) {
    let item = document.getElementById(id);
    if (item) {
        item.style.display = "none";
    }
}

function predictIframe(){

    model.detect(_vedio).then(function (predictions) {
        liveView = document.getElementById(boxid);
        // Remove any highlighting we did previous frame.
        for (let i = 0; i < children.length; i++) {
            liveView.removeChild(children[i]);
        }
        children.splice(0);
        // Now lets loop through predictions and draw them to the live view if
        // they have a high confidence score.
        var heightScale = (_vedio.clientHeight/_vedio.videoHeight);
        var widthScale = (_vedio.clientWidth/_vedio.videoWidth);

        // 全螢幕偏移值
        var widthOffset = 0;
        if (!(!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement)) {
            widthScale = (_vedio.clientHeight/_vedio.videoHeight);
            widthOffset = (_vedio.clientWidth-(_vedio.videoWidth * widthScale))/2
        }

        for (let n = 0; n < predictions.length; n++) {
        // If we are over 66% sure we are sure we classified it right, draw it!
            if (predictions[n].score > 0.66) {
                console.log('Predictions class: ', predictions[n]);
                const p = document.createElement('p');
                p.innerText = predictions[n].class + Math.round(parseFloat(predictions[n].score) * 100) + '%';
                p.style = 'margin-left: ' + (predictions[n].bbox[0]*widthScale + widthOffset) + 'px; margin-top: '
                    + (predictions[n].bbox[1]*heightScale - 10) + 'px; width: ' 
                    + (predictions[n].bbox[2]*widthScale - 10) + 'px; top: 0; left: 0;';
                p.style.zIndex=2;
                p.style.position="absolute";

                const highlighter = document.createElement('div');
                highlighter.setAttribute('class', 'highlighter');
                highlighter.style = 'left: ' + (predictions[n].bbox[0] * widthScale + widthOffset) // 左上原點x 座標
                    + 'px; top: ' + predictions[n].bbox[1]* heightScale     // 左上 原點y 座標
                    + 'px; width: ' + predictions[n].bbox[2] * widthScale   // 左上往右邊加寬邊的長度 
                    + 'px; height: ' + predictions[n].bbox[3] * heightScale // 左上往下方加高的長度
                    + 'px;';
                highlighter.style.zIndex=1;
                highlighter.style.position="absolute";
                

                liveView.appendChild(highlighter);
                liveView.appendChild(p);
                children.push(highlighter);
                children.push(p);
            }
        }
        window.requestAnimationFrame(predictIframe);
    }).catch (function (e) {
        console.log(e);
    })
}


function createImgBox() {
    var box = document.createElement('div');
    box.id = boxid
    return box;
}

function setPlayEvent(video) {
    playButton.addEventListener('click', function () {
        //當影片狀態為暫停的時候
        if (video.paused) {
            //播放影片
            playingStream.play();
            //將播放鈕圖示改為暫停鈕圖示                     
            playButton.innerHTML = '❚❚';
        //當影片是播放的時候                         
        } else {
            //暫停影片
            playingStream.stop();
            //將暫停鈕圖示改為播放鈕圖示     
            playButton.innerHTML = '►';
        };
    });
    video.addEventListener('click', function () {
        //當影片狀態為暫停的時候
        if (video.paused) {
            //播放影片
            playingStream.play();
            //將播放鈕圖示改為暫停鈕圖示                     
            playButton.innerHTML = '❚❚';
        //當影片是播放的時候                         
        } else {
            //暫停影片
            playingStream.stop();
            //將暫停鈕圖示改為播放鈕圖示     
            playButton.innerHTML = '►';
        };
    });

    mute.addEventListener('click', function ()  {
        video.muted = !video.muted;
        mute.classList.toggle('muted');
    })

    // 音量
    playerSound.forEach(range => {
        range.addEventListener('input', function () {
            video.volume = this.value;
        });
    })

    // 全螢幕控制
    fullscreen.addEventListener('click', function () {
        let image = fullscreen.querySelector('img');
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            if(video.requestFullScreen){
                remoteVideo.requestFullScreen();
            } else if(video.webkitRequestFullScreen){
                remoteVideo.webkitRequestFullScreen();
            } else if(video.mozRequestFullScreen){
                remoteVideo.mozRequestFullScreen();
            }
            fullscreen.title = '結束全螢幕';
            image.src = 'images/exitfullscreen.png';
        } else {
            if (document.exitFullscreen) {
              document.exitFullscreen();
            } else if (document.msExitFullscreen) {
              document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
              document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
              document.webkitExitFullscreen();
            }
            fullscreen.title = '全螢幕';
            image.src = 'images/fullscreen.png';
        }
    });
}