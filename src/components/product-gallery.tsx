'use client';

import { useState } from 'react';

export function ProductGallery({
  images,
  productName,
}: {
  images: { url: string; alt: string }[];
  productName: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center bg-sand font-display uppercase tracking-widest text-ink-muted">
        Sin imagen
      </div>
    );
  }

  return (
    <div>
      <div className="aspect-square overflow-hidden bg-sand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]!.url}
          alt={images[active]!.alt || productName}
          className="h-full w-full object-contain"
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-4 flex gap-3 overflow-x-auto no-scrollbar">
          {images.map((image, index) => (
            <button
              key={image.url + index}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Ver imagen ${index + 1} de ${productName}`}
              aria-current={index === active}
              className={`h-20 w-20 shrink-0 border-2 bg-sand transition-colors ${
                index === active ? 'border-ink' : 'border-transparent hover:border-sand-dark'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
