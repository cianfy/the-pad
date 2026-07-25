/* ==========================================================================
   THE PAD - Drag & Drop Handler (drag.js)
   Enables smooth freeform position movement on the canvas view.
   ========================================================================== */

import { db } from './db.js';

export function makeCardDraggable(cardElement, postId) {
  let isDragging = false;
  let startX, startY;
  let initialLeft, initialTop;

  const container = document.getElementById('boardContainer');

  function onPointerDown(e) {
    // Only allow dragging in canvas view mode and if not clicking buttons or input fields
    if (!container.classList.contains('canvas-view')) return;
    if (e.target.closest('.card-actions') || e.target.closest('.reaction-btn') || e.target.closest('.card-comments') || e.target.closest('input') || e.target.closest('button')) {
      return;
    }

    isDragging = true;
    cardElement.style.zIndex = 100;

    const rect = cardElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    startX = e.clientX || (e.touches && e.touches[0].clientX);
    startY = e.clientY || (e.touches && e.touches[0].clientY);

    initialLeft = rect.left - containerRect.left;
    initialTop = rect.top - containerRect.top;

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const currentX = e.clientX || (e.touches && e.touches[0].clientX);
    const currentY = e.clientY || (e.touches && e.touches[0].clientY);

    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;

    // Boundaries inside container
    newLeft = Math.max(10, Math.min(newLeft, container.clientWidth - cardElement.clientWidth - 10));
    newTop = Math.max(10, Math.min(newTop, container.clientHeight - cardElement.clientHeight - 10));

    cardElement.style.left = `${newLeft}px`;
    cardElement.style.top = `${newTop}px`;
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;

    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);

    const finalLeft = parseInt(cardElement.style.left, 10) || 40;
    const finalTop = parseInt(cardElement.style.top, 10) || 40;

    cardElement.style.zIndex = '';
    
    // Update DB with new position
    db.updatePostPosition(postId, finalLeft, finalTop);
  }

  cardElement.addEventListener('pointerdown', onPointerDown);
}
