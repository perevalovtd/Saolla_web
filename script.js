import { loadAllSongData } from './songdata_all.js';

  // Глобальные переменные:
  let currentSongData = null;
  let isPlayingNotes = false;
  let currentTempo = 1.0; // по умолчанию 100%
  let lastPreviewSongIndex = -1; 
  let isPreviewPlaying = false;  // идёт ли сейчас preview
  let isSongPaused = false; 
  

document.addEventListener("DOMContentLoaded", async () => {

  document.getElementById("grayFooterTitle").textContent = "-";
  document.getElementById("grayFooterTimer").textContent = "0.0s";

  // 1) Загружаем все файлы .js (songdata_1,2,3...) динамически:
  const allData = await loadAllSongData(); 
  // allData — массив объектов, каждый { mp3:"...", title:"...", ... }

  // 2) Превращаем это в массив "songs", где title/mp3 и тд
  const songs = allData.map(data => ({
    title: data.title,
    mp3: data.mp3,
    durationSec: data.durationSec,
    noteMin: data.noteMin,
    noteMax: data.noteMax,
    notesCount: data.notesCount,
    zNotes: data.zNotes
  }));



  console.log("Loaded songs:", songs);
// 3) Остальное — как у вас
const songListContainer = document.getElementById("songListContainer");
let selectedSongIndex = 0;

const btnPauseResume = document.getElementById("btnPauseResume");
const btnSkipBack = document.getElementById("btnSkipBack");
const btnSkipForward = document.getElementById("btnSkipForward");

  //делаем прокручиваемый список с кликабельными элементами

const songDivs = [];
songs.forEach((songObj, index) => {
  const itemDiv = document.createElement("div");
  itemDiv.textContent = songObj.title;
  // чтобы мышка показывала «руку» при наведении
  itemDiv.style.cursor = "pointer";

  // По умолчанию, если index=0, считаем песню выбранной
  if (index === 0) {
    itemDiv.style.backgroundColor = "#ddd";  // визуальное выделение
  }

  // При клике меняем выбранную песню
  itemDiv.addEventListener("click", () => {
    selectedSongIndex = index;
    console.log("Selected song index:", selectedSongIndex);

    // Уберём выделение со всех
    [...songListContainer.children].forEach(child => {
      child.style.backgroundColor = "";
    });
    // Выделим текущую
    itemDiv.style.backgroundColor = "#ddd";
  });

  songListContainer.appendChild(itemDiv);
  songDivs[index] = itemDiv;
});


function setPreviewArrow(index, isOn) {
  if (index < 0) return; // на случай если -1
  if (isOn) {
    songDivs[index].textContent = "▶ " + songs[index].title;
  } else {
    songDivs[index].textContent = songs[index].title;
  }
}



  // Кнопки
  const btnPlay = document.getElementById("btnPlay");
  const btnPause = document.getElementById("btnPause");
  const audioPlayer = document.getElementById("audioPlayer");
  const btnPreview = document.getElementById("btnPreview");


  // Базовый URL: http://localhost:3000
  // (Если потом на ESP, замените на http://192.168.4.1)
  const baseUrl = "https://saolla.ru/app"; //https://saolla.ru/app  http://localhost:3000 http://192.168.4.1

  // При нажатии Play отправляем команду + меняем audio.src
  btnPlay.addEventListener("click", () => {
    const cmd = "play";

    // 1) Сначала отправим на /do?cmd=play X
    const startGuitarCheckbox = document.getElementById("startGuitarCheckbox");
    const musicInBrowserCheckbox = document.getElementById("musicInBrowserCheckbox");

    // Если чекбокс включён => отправляем http play
    if (startGuitarCheckbox.checked) {
    // Выполняем fetch(...?cmd=play)
      const cmd = "play";
      fetch(`${baseUrl}/do?cmd=${encodeURIComponent(cmd)}`)
        .then(resp => resp.text())
        .then(data => {
          console.log("Server said:", data);
        })
        .catch(err => console.error("Fetch error:", err));
    } else {
      console.log("Checkbox off => no guitar (not sending play to server).");
    }

    // Логика: musicInBrowser => volume
    
    if (musicInBrowserCheckbox.checked) {
      audioPlayer.muted = false;
    } else {
      audioPlayer.muted = true;
    }

      // Если шла preview, останавливаем
      if (isPreviewPlaying) {
        audioPlayer.pause();
      }
      setPreviewArrow(lastPreviewSongIndex, false);
      isPreviewPlaying = false;
      lastPreviewSongIndex = -1; // сброс

    // 2) Установим плееру правильный src. (songs/song1.mp3)
    const mp3File = songs[selectedSongIndex].mp3; 
    audioPlayer.src = `${baseUrl}/songs/${mp3File}`;
    // 3) Запускаем воспроизведение
    audioPlayer.playbackRate = currentTempo;
    audioPlayer.play()
      .then(() => {
        startNotesForSong(songs[selectedSongIndex]);
        console.log(`Playing: ${mp3File}`);
        scrollToBottom();

        // (Новый шаг) Установить название в #grayFooterTitle
      const rawTitle = songs[selectedSongIndex].title;
      let displayedTitle = rawTitle;
      if (rawTitle.length > 20) {
        displayedTitle = rawTitle.substring(0, 17) +"..."; // первые 20 символов
      }
      document.getElementById("grayFooterTitle").textContent = displayedTitle;

      })
      .catch(err => {
        console.error("Audio play error:", err);
      });
  });

  // При нажатии Pause - отправляем "pause" и ставим плеер на паузу
  btnPause.addEventListener("click", () => {
    if (isPlayingNotes) {
      fetch(`${baseUrl}/do?cmd=${encodeURIComponent("stop")}`)
        .then(resp => resp.text())
        .then(data => {
          console.log("Server said:", data);
        })
        .catch(err => console.error("Fetch error:", err));
      
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      stopNotes();
      console.log("Paused local playback");
    } else {
      console.log("Stop ignored (not playing notes)");
    }

  });

  // 2) Вешаем обработчик
  btnPreview.addEventListener("click", () => {
    if (isPlayingNotes) {
      // останавливаем ноты
      stopNotes();
      isPlayingNotes = false;
      // останавливаем плеер
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }

  // Если пользователь выбрал другую песню => старт с начала
    if (selectedSongIndex !== lastPreviewSongIndex) {
    // 1) Ставим audioPlayer.src = ...

      if (lastPreviewSongIndex >= 0) {
        setPreviewArrow(lastPreviewSongIndex, false);
      }

      

      const mp3File = songs[selectedSongIndex].mp3;
      audioPlayer.src = `${baseUrl}/songs/${mp3File}`;

      // 2) Ставим скорость = 100% (1.0)
      audioPlayer.playbackRate = 1.0;
      audioPlayer.muted = false;

      // 3) Сбрасываем позицию в 0 (начать с начала)
      audioPlayer.currentTime = 0;

      // 4) Запускаем воспроизведение (no notes!)
      audioPlayer.play()
        .then(() => {
          console.log("Preview: playing new song from start:", mp3File);
          lastPreviewSongIndex = selectedSongIndex;
          isPreviewPlaying = true;
          setPreviewArrow(selectedSongIndex, true);
        })
        .catch(err => console.error("Preview play error:", err));

    } else {
    // Та же самая песня => пауза/возобновление
      if (isPreviewPlaying) {
        // Пауза
        audioPlayer.pause();
        isPreviewPlaying = false;
        console.log("Preview: paused current song");
      } else {
        // Продолжить с того же места
        audioPlayer.playbackRate = 1.0;    // всегда 100%
        audioPlayer.play()
          .then(() => {
            console.log("Preview: resumed same song");
            isPreviewPlaying = true;
          })
          .catch(err => console.error("Preview resume error:", err));
      }
    }
  });

  musicInBrowserCheckbox.addEventListener("change", () => {
    if (isPlayingNotes) {
      // сейчас идет Play => сразу меняем громкость
      audioPlayer.muted = musicInBrowserCheckbox.checked ? false : true;
    }
    // если Preview => игнорируем (preview = 1.0)
  });


  // Ищем выпадающий список <select id="tempoSelect">
  const tempoSelect = document.getElementById("tempoSelect");

  // Добавляем обработчик на событие 'change'
  tempoSelect.addEventListener("change", (e) => {
  // Считываем value (строка "1.0", "0.75" или "0.5")
    const newTempo = parseFloat(e.target.value);
    currentTempo = newTempo;
    // Присваиваем новый темп для аудиоплеера
    if (!isPreviewPlaying) {
      audioPlayer.playbackRate = newTempo;
    }
  });

  updateSongListHeight();
  updateGrayFooterHeight();

  // 2) Добавим обработчик на "resize" (и "orientationchange"), 
  //    чтобы при повороте экрана пересчитать:
  window.addEventListener("resize", () => {
    updateSongListHeight(); 
    updateGrayFooterHeight();
    if (isPlayingNotes) {
      scrollToBottom();
    }
  });

  function updateSongListHeight() {
    const previewBlock = document.getElementById("previewBlock");
    const songList = document.getElementById("songListContainer");
  
    // (A) Высота «правого блока» (Preview + чекбоксы + Tempo)
    const previewRect = previewBlock.getBoundingClientRect();
    const previewHeight = previewRect.height*1.2; // в px
  
    // (B) 30vh в px
    //const thirtyVhPx = window.innerHeight * 0.3;
  
    // (C) Берём "больший" => т. е. Math.max(previewHeight, thirtyVhPx)
    let desiredHeight = previewHeight
  
    // (D) Ограничиваем максимумом 
    desiredHeight = Math.min(desiredHeight, 400);
  
    // (E) Присваиваем высоту списку
    songList.style.height = desiredHeight + "px";
    songAndPreview.style.height = desiredHeight + "px";
  }

  function updateGrayFooterHeight() {
    const grayFooter = document.getElementById("grayFooter");
    const titleElem = document.getElementById("grayFooterTitle");
    const pauseWrapper = document.getElementById("grayFooterPauseWrapper");
  
    // 1) Берём прямоугольники
    const rectTitle = titleElem.getBoundingClientRect();
    const rectPause = pauseWrapper.getBoundingClientRect();
  
    // 2) Вычисляем разницу
    //    Но обратите внимание, getBoundingClientRect() 
    //    возвращает координаты относительно окна (viewport).
    //    Мы предполагаем, что grayFooter тоже в потоке, 
    //    так что их top/bottom сопоставимы. 
    //    Иначе можно сначала определить offsetTop/offsetHeight и т.п.
    const neededHeight = (rectPause.bottom - rectTitle.top);
  
    // Можем добавить небольшой запас / padding, например + 10px
    const finalHeight = neededHeight + 10;  // на ваш вкус
  
    // 3) Присваиваем
    grayFooter.style.height = finalHeight + "px";
    console.log("Gray footer new height:", finalHeight);
  }

  function scrollToBottom() {
    // Способ A: «плавная» прокрутка (поддерживается современными браузерами)
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth"
    });
  
    // Или способ B (старый) - мгновенно:
    // window.scrollTo(0, document.body.scrollHeight);
  }
  
   // Обработчик клика по кнопке «пауза/возобновить»
  btnPauseResume.addEventListener("click", () => {
    if (!isPlayingNotes) {
      // Если сейчас вообще не идёт воспроизведение (isPlayingNotes = false),
      // то кнопку можно либо игнорировать, либо «молча» ничего не делать.
      console.log("No active song - ignoring pause/resume");
      return;
    }
    
    if (audioPlayer.ended && isSongPaused) {
      console.log("Track ended, user presses pause/resume => send 'play' to server");
  
      const startGuitarCheckbox = document.getElementById("startGuitarCheckbox");
      if (startGuitarCheckbox.checked) {
        // Отправим "play" на сервер
        fetch(`${baseUrl}/do?cmd=play`)
          .then(resp => resp.text())
          .then(data => {
            console.log("Server said:", data);
          })
          .catch(err => console.error("Fetch error:", err));
      }
  
    }

    if (!isSongPaused) {
      // Текущая песня играет — ставим на паузу
      audioPlayer.pause();
      btnPauseResume.textContent = "▷"; // показываем "Play" иконку
      isSongPaused = true;
    } else {
      // Песня на паузе — возобновляем воспроизведение
      audioPlayer.play();
      btnPauseResume.textContent = "| |"; // возвращаем "Pause"
      isSongPaused = false;
    }
  });

  // Вешаем обработчик «перемотать назад 5 секунд»
btnSkipBack.addEventListener("click", () => {
  //if (!isPlayingNotes) return;
  const ended = audioPlayer.ended;
  const t = audioPlayer.currentTime;
  const newT = Math.max(t - 5, 0);
  audioPlayer.currentTime = newT;
  
  
});

// Вешаем обработчик «перемотать вперёд 5 секунд»
btnSkipForward.addEventListener("click", () => {
  if (!isPlayingNotes) return;
  // Например, не даём выходить за границы длины трека (optionally)
  const duration = audioPlayer.duration || 0;
  const t = audioPlayer.currentTime;
  audioPlayer.currentTime = Math.min(t + 5, duration);
});


  function updateTimer() {
    // Предположим, у вас есть <audio id="audioPlayer">:
    const audio = document.getElementById("audioPlayer");
    
    // Получаем текущее время в секундах (число с плавающей запятой)
    const currentTimeSec = audio.currentTime;
    
    // Форматируем с одним знаком после запятой
    const timeStr = currentTimeSec.toFixed(1) + "s";
    
    // Вставляем в элемент на странице
    document.getElementById("grayFooterTimer").textContent = timeStr;
  }

  function startNotesForSong(songObj) {
    currentSongData = songObj;
    isPlayingNotes = true;
    isSongPaused = false;   
    btnPauseResume.textContent = "| |"; 
    requestAnimationFrame(drawNotesFrame);
  }

  
  function stopNotes() {
    isPlayingNotes = false;
    currentSongData = null;
    const canvas = document.getElementById("notesCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    isSongPaused = false;
    btnPauseResume.textContent = "| |";
    document.getElementById("grayFooterTimer").textContent = "0.0s";
    document.getElementById("grayFooterTitle").textContent = "-";
    
  }


  function drawNotesFrame() {
    if (!isPlayingNotes || !currentSongData) return;
  
    const canvas = document.getElementById("notesCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  
    const audio = document.getElementById("audioPlayer");
    const currentTimeSec = audio.currentTime;
  
    const { noteMin, noteMax, zNotes } = currentSongData;
    const range = noteMax - noteMin;
  
    const windowSec = 5;
    zNotes.forEach(z => {
      const dt = z.time - currentTimeSec;
      if (dt > 0 && dt < windowSec) {
        const frac = 1 - (dt / windowSec);
        const size_y=4;
        const margin_y = size_y*0.5;
        const drawableHeight = canvas.height - (margin_y * 2);
        const y = margin_y+(frac * drawableHeight);
        z.notes.forEach(notePitch => {
          const pitchFrac = (notePitch - noteMin) / range;
          // Допустим, хотим слева и справа отступ по 5 пикселей,
          // чтобы целиком влезал прямоугольник 10x10.
          const size_x = 10;
          const margin = size_x*0.5;
          const drawableWidth = canvas.width - (margin * 2);
          // pitchFrac от 0 до 1.
          // Чтобы крайняя нота (pitchFrac=0) рисовалась на x=margin,
          // а (pitchFrac=1) рисовалась на x=(margin + drawableWidth)
          const x = margin + (pitchFrac * drawableWidth);
          //const y = margin + (pitchFrac * drawableHeight);
          ctx.fillStyle = "white";
          ctx.fillRect(x - (size_x*0.5), y -(size_y*0.5), size_x, size_y+0.25);
        });
      }
    });
    updateTimer();
  
    requestAnimationFrame(drawNotesFrame);
  }


  audioPlayer.addEventListener("ended", () => {
    console.log("audio ended - do nothing about isSongPaused");
    // при желании можем вызвать stopNotes(), но без выставления isSongPaused = true
    // или вообще не останавливать ноты, 
    // если хотим, чтобы при "отмотке" ноты продолжились
    isSongPaused = true;
    btnPauseResume.textContent = "▷";
  });
  
  
});


