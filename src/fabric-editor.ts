// Fabric Editor - allows adjusting scale, rotation, position of fabric image
// and crops/resamples to a single block size

export interface FabricEditState {
  sourceImage: HTMLImageElement;
  scale: number;      // 0.1 to 3.0
  rotation: number;   // 0 to 360
  offsetX: number;    // -1 to 1 (relative to block)
  offsetY: number;    // -1 to 1 (relative to block)
}

export interface FabricEditorCallbacks {
  onConfirm: (croppedDataUrl: string, sourceDataUrl: string) => void;
  onCancel: () => void;
}

const BLOCK_SIZE = 200; // Preview block size in pixels

export function createFabricEditor(
  container: HTMLElement,
  callbacks: FabricEditorCallbacks
): {
  loadImage: (dataUrl: string) => void;
  destroy: () => void;
} {
  let state: FabricEditState | null = null;
  let animFrame: number | null = null;

  // Create DOM structure
  container.innerHTML = `
    <div class="fabric-editor">
      <div class="fabric-preview-container">
        <canvas class="fabric-preview" width="${BLOCK_SIZE}" height="${BLOCK_SIZE}"></canvas>
        <div class="fabric-overlay"></div>
      </div>
      <div class="fabric-controls">
        <div class="fabric-control">
          <label>Scale</label>
          <input type="range" class="fabric-scale" min="10" max="300" value="100" />
          <span class="fabric-scale-val">100%</span>
        </div>
        <div class="fabric-control">
          <label>Rotation</label>
          <input type="range" class="fabric-rotation" min="0" max="360" value="0" />
          <span class="fabric-rotation-val">0°</span>
        </div>
        <div class="fabric-control">
          <label>Position X</label>
          <input type="range" class="fabric-offset-x" min="-100" max="100" value="0" />
        </div>
        <div class="fabric-control">
          <label>Position Y</label>
          <input type="range" class="fabric-offset-y" min="-100" max="100" value="0" />
        </div>
      </div>
      <div class="fabric-actions">
        <button class="btn btn-secondary fabric-cancel">Cancel</button>
        <button class="btn fabric-confirm">Use This Fabric</button>
      </div>
    </div>
  `;

  const canvas = container.querySelector(".fabric-preview") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const scaleSlider = container.querySelector(".fabric-scale") as HTMLInputElement;
  const scaleVal = container.querySelector(".fabric-scale-val") as HTMLSpanElement;
  const rotationSlider = container.querySelector(".fabric-rotation") as HTMLInputElement;
  const rotationVal = container.querySelector(".fabric-rotation-val") as HTMLSpanElement;
  const offsetXSlider = container.querySelector(".fabric-offset-x") as HTMLInputElement;
  const offsetYSlider = container.querySelector(".fabric-offset-y") as HTMLInputElement;
  const confirmBtn = container.querySelector(".fabric-confirm") as HTMLButtonElement;
  const cancelBtn = container.querySelector(".fabric-cancel") as HTMLButtonElement;

  function render() {
    if (!state) return;

    ctx.clearRect(0, 0, BLOCK_SIZE, BLOCK_SIZE);
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, BLOCK_SIZE, BLOCK_SIZE);

    ctx.save();
    
    // Move to center, apply transforms, draw image centered
    ctx.translate(BLOCK_SIZE / 2, BLOCK_SIZE / 2);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(state.scale, state.scale);
    
    const img = state.sourceImage;
    const offsetPx = {
      x: state.offsetX * BLOCK_SIZE / 2,
      y: state.offsetY * BLOCK_SIZE / 2,
    };
    
    ctx.drawImage(
      img,
      -img.width / 2 + offsetPx.x / state.scale,
      -img.height / 2 + offsetPx.y / state.scale
    );
    
    ctx.restore();

    // Draw block outline
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, BLOCK_SIZE, BLOCK_SIZE);

    // Draw HST diagonal
    ctx.strokeStyle = "#ff6b6b";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(BLOCK_SIZE, BLOCK_SIZE);
    ctx.stroke();

    // Draw QST lines
    ctx.strokeStyle = "#4ecdc4";
    ctx.beginPath();
    ctx.moveTo(BLOCK_SIZE, 0);
    ctx.lineTo(0, BLOCK_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(BLOCK_SIZE / 2, BLOCK_SIZE / 2);
    ctx.lineTo(0, 0);
    ctx.moveTo(BLOCK_SIZE / 2, BLOCK_SIZE / 2);
    ctx.lineTo(BLOCK_SIZE, 0);
    ctx.moveTo(BLOCK_SIZE / 2, BLOCK_SIZE / 2);
    ctx.lineTo(BLOCK_SIZE, BLOCK_SIZE);
    ctx.moveTo(BLOCK_SIZE / 2, BLOCK_SIZE / 2);
    ctx.lineTo(0, BLOCK_SIZE);
    ctx.stroke();
    
    ctx.setLineDash([]);
  }

  function updateFromSliders() {
    if (!state) return;
    state.scale = Number(scaleSlider.value) / 100;
    state.rotation = Number(rotationSlider.value);
    state.offsetX = Number(offsetXSlider.value) / 100;
    state.offsetY = Number(offsetYSlider.value) / 100;
    
    scaleVal.textContent = `${scaleSlider.value}%`;
    rotationVal.textContent = `${rotationSlider.value}°`;
    
    render();
  }

  function generateCroppedImage(): string {
    if (!state) return "";
    
    // Create a clean canvas for the final cropped image
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = BLOCK_SIZE;
    cropCanvas.height = BLOCK_SIZE;
    const cropCtx = cropCanvas.getContext("2d")!;

    cropCtx.save();
    cropCtx.translate(BLOCK_SIZE / 2, BLOCK_SIZE / 2);
    cropCtx.rotate((state.rotation * Math.PI) / 180);
    cropCtx.scale(state.scale, state.scale);
    
    const img = state.sourceImage;
    const offsetPx = {
      x: state.offsetX * BLOCK_SIZE / 2,
      y: state.offsetY * BLOCK_SIZE / 2,
    };
    
    cropCtx.drawImage(
      img,
      -img.width / 2 + offsetPx.x / state.scale,
      -img.height / 2 + offsetPx.y / state.scale
    );
    cropCtx.restore();

    return cropCanvas.toDataURL("image/jpeg", 0.85);
  }

  // Event listeners
  scaleSlider.addEventListener("input", updateFromSliders);
  rotationSlider.addEventListener("input", updateFromSliders);
  offsetXSlider.addEventListener("input", updateFromSliders);
  offsetYSlider.addEventListener("input", updateFromSliders);

  confirmBtn.addEventListener("click", () => {
    if (!state) return;
    const cropped = generateCroppedImage();
    const source = state.sourceImage.src;
    callbacks.onConfirm(cropped, source);
  });

  cancelBtn.addEventListener("click", () => {
    callbacks.onCancel();
  });

  return {
    loadImage(dataUrl: string) {
      const img = new Image();
      img.onload = () => {
        state = {
          sourceImage: img,
          scale: 1,
          rotation: 0,
          offsetX: 0,
          offsetY: 0,
        };
        
        // Auto-scale to fit block
        const fitScale = Math.max(BLOCK_SIZE / img.width, BLOCK_SIZE / img.height);
        state.scale = fitScale;
        scaleSlider.value = String(Math.round(fitScale * 100));
        scaleVal.textContent = `${Math.round(fitScale * 100)}%`;
        
        rotationSlider.value = "0";
        rotationVal.textContent = "0°";
        offsetXSlider.value = "0";
        offsetYSlider.value = "0";
        
        render();
      };
      img.src = dataUrl;
    },
    destroy() {
      if (animFrame) cancelAnimationFrame(animFrame);
      container.innerHTML = "";
    },
  };
}
