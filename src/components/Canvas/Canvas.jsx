import { useRef, useEffect } from "react";

function Canvas() {
  const canvasRef = useRef(null);
  const canvasSquareSize = 800;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const rows = 16;
    const cols = 16;

    const cellSize = canvasSquareSize / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.strokeRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSquareSize}
      height={canvasSquareSize}
    />
  );
}

export default Canvas;
