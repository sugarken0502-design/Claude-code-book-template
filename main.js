const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restart-btn');

// キャラクター画像
const imgDekka = new Image();
imgDekka.src = 'dekka.png';
const imgHetta = new Image();
imgHetta.src = 'hetta.png';

// 音声
let lastSpeakTime = 0;
const SPEAK_INTERVAL = 5000; // ミリ秒

function speakDekka(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 1.0;
  utter.pitch = 1.1;
  window.speechSynthesis.speak(utter);
}

// --- 定数 ---
const W = canvas.width;
const H = canvas.height;
const PADDLE_H = 12;
const PADDLE_W = 80;
const BALL_R = 8;
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_W = 42;
const BRICK_H = 18;
const BRICK_PAD = 4;
const BRICK_OFFSET_TOP = 60;
const BRICK_OFFSET_LEFT = (W - (BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2;

const ROW_COLORS = ['#e94560', '#e07b39', '#e0c239', '#5cb85c', '#4da8da'];

// デッカちゃんの設定
const DEKKA_BASE_R = 22;
const DEKKA_GROW = 12; // 1回当たるごとに大きくなるサイズ
const HETTA_R = 14;

// --- ゲーム状態 ---
let score, lives, level, gameRunning, gamePaused;
let ball, paddle, bricks, dekka;
let animId;
let keys = {};

function initGame() {
  score = 0;
  lives = 3;
  level = 1;
  gameRunning = true;
  gamePaused = false;
  restartBtn.style.display = 'none';
  messageEl.textContent = '← → キーまたはマウスでパドルを動かそう';
  initLevel();
  updateHUD();
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function initLevel() {
  paddle = {
    x: W / 2 - PADDLE_W / 2,
    y: H - 30,
    w: PADDLE_W,
    h: PADDLE_H,
    speed: 6,
  };

  const speed = 3 + (level - 1) * 0.5;
  ball = {
    x: W / 2,
    y: H - 60,
    r: BALL_R,
    dx: speed * (Math.random() < 0.5 ? 1 : -1),
    dy: -speed,
    launched: false,
  };

  bricks = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: BRICK_OFFSET_LEFT + c * (BRICK_W + BRICK_PAD),
        y: BRICK_OFFSET_TOP + r * (BRICK_H + BRICK_PAD),
        w: BRICK_W,
        h: BRICK_H,
        color: ROW_COLORS[r],
        alive: true,
        points: (BRICK_ROWS - r) * 10,
      });
    }
  }

  // デッカちゃん初期化
  dekka = {
    x: 80,
    y: 200,
    r: DEKKA_BASE_R,
    dx: 2.5 * (Math.random() < 0.5 ? 1 : -1),
    dy: 2.2 * (Math.random() < 0.5 ? 1 : -1),
    hits: 0,        // ボールに当たった回数
    isHetta: false, // ヘッタちゃんに変身したか
    flashTimer: 0,  // 当たったときの点滅タイマー
  };
}

function updateHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
}

// --- 入力 ---
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ' || e.key === 'ArrowUp') {
    if (!ball.launched) ball.launched = true;
  }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  paddle.x = mx - paddle.w / 2;
  clampPaddle();
});

canvas.addEventListener('click', () => {
  if (!ball.launched) ball.launched = true;
});

function clampPaddle() {
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + paddle.w > W) paddle.x = W - paddle.w;
}

// --- 更新 ---
function update() {
  if (!gameRunning) return;

  // パドル移動（キーボード）
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
    paddle.x -= paddle.speed;
  }
  if (keys['ArrowRight'] || keys['d'] || keys['D']) {
    paddle.x += paddle.speed;
  }
  clampPaddle();

  // ボール未発射時はパドルに追従
  if (!ball.launched) {
    ball.x = paddle.x + paddle.w / 2;
    updateDekka();
    return;
  }

  // ボール移動
  ball.x += ball.dx;
  ball.y += ball.dy;

  // 壁反射（左右）
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.dx = Math.abs(ball.dx);
  }
  if (ball.x + ball.r > W) {
    ball.x = W - ball.r;
    ball.dx = -Math.abs(ball.dx);
  }

  // 壁反射（上）
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.dy = Math.abs(ball.dy);
  }

  // パドルとの当たり判定
  if (
    ball.dy > 0 &&
    ball.x > paddle.x &&
    ball.x < paddle.x + paddle.w &&
    ball.y + ball.r >= paddle.y &&
    ball.y + ball.r <= paddle.y + paddle.h + Math.abs(ball.dy)
  ) {
    ball.y = paddle.y - ball.r;
    const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
    const angle = hit * (Math.PI / 3);
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    ball.dx = speed * Math.sin(angle);
    ball.dy = -speed * Math.cos(angle);
  }

  // ボールが落ちた
  if (ball.y - ball.r > H) {
    lives--;
    updateHUD();
    if (lives <= 0) {
      gameOver();
    } else {
      resetBall();
    }
    return;
  }

  // ブロックとの当たり判定
  for (const b of bricks) {
    if (!b.alive) continue;
    if (
      ball.x + ball.r > b.x &&
      ball.x - ball.r < b.x + b.w &&
      ball.y + ball.r > b.y &&
      ball.y - ball.r < b.y + b.h
    ) {
      b.alive = false;
      score += b.points;
      updateHUD();

      const overlapL = ball.x + ball.r - b.x;
      const overlapR = b.x + b.w - (ball.x - ball.r);
      const overlapT = ball.y + ball.r - b.y;
      const overlapB = b.y + b.h - (ball.y - ball.r);
      const minH = Math.min(overlapL, overlapR);
      const minV = Math.min(overlapT, overlapB);
      if (minH < minV) {
        ball.dx = -ball.dx;
      } else {
        ball.dy = -ball.dy;
      }
      break;
    }
  }

  // 全ブロック破壊チェック
  if (bricks.every(b => !b.alive)) {
    level++;
    updateHUD();
    messageEl.textContent = `レベル ${level} スタート！`;
    initLevel();
    ball.launched = false;
  }

  // デッカちゃん更新
  updateDekka();
}

function updateDekka() {
  // デッカちゃん自律移動
  dekka.x += dekka.dx;
  dekka.y += dekka.dy;

  // 壁反射
  if (dekka.x - dekka.r < 0) {
    dekka.x = dekka.r;
    dekka.dx = Math.abs(dekka.dx);
  }
  if (dekka.x + dekka.r > W) {
    dekka.x = W - dekka.r;
    dekka.dx = -Math.abs(dekka.dx);
  }
  if (dekka.y - dekka.r < 0) {
    dekka.y = dekka.r;
    dekka.dy = Math.abs(dekka.dy);
  }
  // 下はパドルより上で反射（画面下には行かない）
  if (dekka.y + dekka.r > H - 50) {
    dekka.y = H - 50 - dekka.r;
    dekka.dy = -Math.abs(dekka.dy);
  }

  // フラッシュタイマー
  if (dekka.flashTimer > 0) dekka.flashTimer--;

  // 定期的に喋る
  const now = performance.now();
  if (ball.launched && now - lastSpeakTime > SPEAK_INTERVAL) {
    lastSpeakTime = now;
    speakDekka(dekka.isHetta ? 'ヘッタちゃんだよ' : 'デッカちゃんだよ');
  }

  // ボールとデッカちゃんの当たり判定
  if (ball.launched) {
    const dist = Math.hypot(ball.x - dekka.x, ball.y - dekka.y);
    if (dist < ball.r + dekka.r) {
      // 跳ね返し（ボールをデッカちゃんの中心から弾く）
      const angle = Math.atan2(ball.y - dekka.y, ball.x - dekka.x);
      const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
      ball.dx = speed * Math.cos(angle);
      ball.dy = speed * Math.sin(angle);
      // めり込み補正
      const overlap = ball.r + dekka.r - dist;
      ball.x += Math.cos(angle) * overlap;
      ball.y += Math.sin(angle) * overlap;

      dekka.hits++;
      dekka.flashTimer = 20;

      if (dekka.hits >= 3 && !dekka.isHetta) {
        // ヘッタちゃんに変身
        dekka.isHetta = true;
        dekka.r = HETTA_R;
        messageEl.textContent = 'ヘッタちゃんになっちゃった！';
        score += 200;
        updateHUD();
        speakDekka('ヘッタちゃんになっちゃった！');
        lastSpeakTime = performance.now();
      } else if (!dekka.isHetta) {
        // 大きくなる
        dekka.r = DEKKA_BASE_R + dekka.hits * DEKKA_GROW;
        score += 50;
        updateHUD();
      }
    }
  }
}

function resetBall() {
  const speed = 3 + (level - 1) * 0.5;
  ball = {
    x: paddle.x + paddle.w / 2,
    y: paddle.y - BALL_R - 2,
    r: BALL_R,
    dx: speed * (Math.random() < 0.5 ? 1 : -1),
    dy: -speed,
    launched: false,
  };
  messageEl.textContent = 'スペースキーまたはクリックで再発射';
}

function gameOver() {
  gameRunning = false;
  messageEl.textContent = `ゲームオーバー！ 最終スコア: ${score}`;
  restartBtn.style.display = 'inline-block';
}

// --- 描画 ---
function draw() {
  ctx.clearRect(0, 0, W, H);

  // ブロック
  for (const b of bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 6;
    roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // パドル
  ctx.fillStyle = '#a8dadc';
  ctx.shadowColor = '#a8dadc';
  ctx.shadowBlur = 10;
  roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ボール
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = '#e94560';
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  // デッカちゃん / ヘッタちゃん
  drawDekka();
}

function drawDekka() {
  const flashing = dekka.flashTimer > 0 && Math.floor(dekka.flashTimer / 3) % 2 === 0;
  if (flashing) return; // 点滅で一瞬消す

  const img = dekka.isHetta ? imgHetta : imgDekka;
  const size = dekka.r * 2;

  ctx.save();
  ctx.translate(dekka.x, dekka.y);

  // 円形クリップ
  ctx.beginPath();
  ctx.arc(0, 0, dekka.r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, -dekka.r, -dekka.r, size, size);

  ctx.restore();

  // ラベルとヒット数（クリップ外）
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (dekka.isHetta) {
    ctx.fillStyle = '#ff6666';
    ctx.font = `bold 13px sans-serif`;
    ctx.fillText('ヘッタちゃん', dekka.x, dekka.y + dekka.r + 4);
  } else {
    const hitsLeft = 3 - dekka.hits;
    ctx.fillStyle = '#ffcc44';
    ctx.font = `bold 13px sans-serif`;
    ctx.fillText(`デッカちゃん (あと${hitsLeft}回)`, dekka.x, dekka.y + dekka.r + 4);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// --- ループ ---
function loop() {
  update();
  draw();
  if (gameRunning) {
    animId = requestAnimationFrame(loop);
  }
}

// --- 外部から呼ぶリスタート ---
function restartGame() {
  initGame();
}

// 起動
initGame();
