import Image from "next/image";

export function PhotoView({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1280}
      height={960}
      unoptimized
      sizes="(min-width: 768px) 40rem, 100vw"
      className="h-auto max-h-[28rem] w-full rounded-[1.5rem] bg-camera object-contain"
    />
  );
}
