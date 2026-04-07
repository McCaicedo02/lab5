const rainCanvas = document.getElementById("rainCanvas");

if (rainCanvas) {
  const ctx = rainCanvas.getContext("2d");
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raindrops = [];
  let farDrops = [];
  let lastTime = performance.now();

  const createDrop = (layer = "front") => {
    const isFront = layer === "front";
    return {
      x: Math.random() * (width + 300) - 150,
      y: Math.random() * height - height,
      length: isFront ? 14 + Math.random() * 22 : 8 + Math.random() * 14,
      speedY: isFront ? 720 + Math.random() * 520 : 380 + Math.random() * 260,
      speedX: isFront ? -140 - Math.random() * 90 : -70 - Math.random() * 50,
      alpha: isFront ? 0.16 + Math.random() * 0.22 : 0.08 + Math.random() * 0.12,
      width: isFront ? 1 + Math.random() * 1.1 : 0.5 + Math.random() * 0.7
    };
  };

  const populateRain = () => {
    const areaFactor = (width * height) / 90000;
    const frontCount = Math.max(140, Math.floor(areaFactor * 18));
    const backCount = Math.max(90, Math.floor(areaFactor * 12));

    raindrops = Array.from({ length: frontCount }, () => createDrop("front"));
    farDrops = Array.from({ length: backCount }, () => createDrop("back"));
  };

  const resizeCanvas = () => {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    rainCanvas.width = Math.floor(width * dpr);
    rainCanvas.height = Math.floor(height * dpr);
    rainCanvas.style.width = `${width}px`;
    rainCanvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    populateRain();
  };

  const recycleDrop = (drop, layer) => {
    const fresh = createDrop(layer);
    drop.x = Math.random() * (width + 300) - 150;
    drop.y = -fresh.length - Math.random() * height * 0.35;
    drop.length = fresh.length;
    drop.speedY = fresh.speedY;
    drop.speedX = fresh.speedX;
    drop.alpha = fresh.alpha;
    drop.width = fresh.width;
  };

  const drawLayer = (drops) => {
    for (const drop of drops) {
      ctx.beginPath();
      ctx.lineWidth = drop.width;
      ctx.strokeStyle = `rgba(210, 232, 255, ${drop.alpha})`;
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + drop.speedX * 0.03, drop.y + drop.length);
      ctx.stroke();
    }
  };

  const updateLayer = (drops, delta, layer) => {
    for (const drop of drops) {
      drop.x += drop.speedX * delta;
      drop.y += drop.speedY * delta;

      if (drop.y > height + 40 || drop.x < -220) {
        recycleDrop(drop, layer);
      }
    }
  };

  const animate = (now) => {
    const delta = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    updateLayer(farDrops, delta, "back");
    updateLayer(raindrops, delta, "front");

    drawLayer(farDrops);
    drawLayer(raindrops);

    requestAnimationFrame(animate);
  };

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  requestAnimationFrame((time) => {
    lastTime = time;
    animate(time);
  });
}
