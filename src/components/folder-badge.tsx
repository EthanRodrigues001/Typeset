"use client";

import * as React from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export type FolderColorKey = "violet" | "cyan" | "amber" | "pink" | "emerald";

export const FOLDER_COLOR_OPTIONS: Array<{
  key: FolderColorKey;
  label: string;
  swatchClassName: string;
}> = [
  { key: "violet", label: "Violet", swatchClassName: "bg-violet-400" },
  { key: "cyan", label: "Cyan", swatchClassName: "bg-cyan-400" },
  { key: "amber", label: "Amber", swatchClassName: "bg-amber-400" },
  { key: "pink", label: "Pink", swatchClassName: "bg-pink-400" },
  { key: "emerald", label: "Emerald", swatchClassName: "bg-emerald-400" },
];

const folderThemes: Record<
  FolderColorKey,
  {
    back: string;
    tab: string;
    front: string;
    line: string;
    preview: string;
  }
> = {
  violet: {
    back: "from-violet-500 to-violet-600",
    tab: "from-violet-400 to-violet-500",
    front: "from-violet-400 to-violet-500",
    line: "bg-violet-200/55",
    preview: "from-violet-200 to-violet-500",
  },
  cyan: {
    back: "from-cyan-500 to-cyan-600",
    tab: "from-cyan-400 to-cyan-500",
    front: "from-cyan-400 to-cyan-500",
    line: "bg-cyan-200/55",
    preview: "from-cyan-100 to-cyan-500",
  },
  amber: {
    back: "from-amber-500 to-amber-600",
    tab: "from-amber-400 to-amber-500",
    front: "from-amber-400 to-amber-500",
    line: "bg-amber-200/55",
    preview: "from-amber-100 to-amber-500",
  },
  pink: {
    back: "from-pink-500 to-pink-600",
    tab: "from-pink-400 to-pink-500",
    front: "from-pink-400 to-pink-500",
    line: "bg-pink-200/55",
    preview: "from-pink-100 to-pink-500",
  },
  emerald: {
    back: "from-emerald-500 to-emerald-600",
    tab: "from-emerald-400 to-emerald-500",
    front: "from-emerald-400 to-emerald-500",
    line: "bg-emerald-200/55",
    preview: "from-emerald-100 to-emerald-500",
  },
};

export function normalizeFolderColor(value: string | undefined): FolderColorKey {
  return FOLDER_COLOR_OPTIONS.some((option) => option.key === value)
    ? (value as FolderColorKey)
    : "violet";
}

export function FolderBadge({
  text,
  color = "violet",
  images = [],
  className,
  textClassName,
  folderSize = { width: 32, height: 24 },
  teaserImageSize = { width: 20, height: 14 },
  hoverImageSize = { width: 48, height: 32 },
  hoverTranslateY = -35,
  hoverSpread = 20,
  hoverRotation = 15,
  previewCount = 3,
}: {
  text?: string;
  color?: FolderColorKey;
  images?: string[];
  className?: string;
  textClassName?: string;
  folderSize?: { width: number; height: number };
  teaserImageSize?: { width: number; height: number };
  hoverImageSize?: { width: number; height: number };
  hoverTranslateY?: number;
  hoverSpread?: number;
  hoverRotation?: number;
  previewCount?: number;
}) {
  const [isHovered, setIsHovered] = React.useState(false);
  const theme = folderThemes[color];
  const displayItems = Array.from({
    length: Math.min(Math.max(previewCount, images.length), 3),
  });
  const tabWidth = folderSize.width * 0.375;
  const tabHeight = folderSize.height * 0.25;

  return (
    <span
      className={cn(
        "inline-flex min-w-0 cursor-default items-center gap-2 [perspective:1000px]",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.span
        className="relative shrink-0"
        style={{
          width: folderSize.width,
          height: folderSize.height,
          transformStyle: "preserve-3d",
        }}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-[4px] bg-gradient-to-b shadow-sm",
            theme.back
          )}
        >
          <span
            className={cn(
              "absolute left-0.5 rounded-t-[2px] bg-gradient-to-b",
              theme.tab
            )}
            style={{
              top: -tabHeight * 0.65,
              width: tabWidth,
              height: tabHeight,
            }}
          />
        </span>

        {displayItems.map((_, index) => {
          const totalItems = displayItems.length;
          const baseRotation =
            totalItems === 1
              ? 0
              : totalItems === 2
                ? (index - 0.5) * hoverRotation
                : (index - 1) * hoverRotation;
          const hoverY = hoverTranslateY - (totalItems - 1 - index) * 3;
          const hoverX =
            totalItems === 1
              ? 0
              : totalItems === 2
                ? (index - 0.5) * hoverSpread
                : (index - 1) * hoverSpread;
          const teaseY = -4 - (totalItems - 1 - index);
          const teaseRotation =
            totalItems === 1
              ? 0
              : totalItems === 2
                ? (index - 0.5) * 3
                : (index - 1) * 3;

          return (
            <motion.span
              key={index}
              className={cn(
                "absolute top-0.5 left-1/2 origin-bottom overflow-hidden rounded-[3px] bg-gradient-to-br shadow-sm ring-1 shadow-black/10 ring-black/10",
                theme.preview
              )}
              animate={{
                x: `calc(-50% + ${isHovered ? hoverX : 0}px)`,
                y: isHovered ? hoverY : teaseY,
                rotate: isHovered ? baseRotation : teaseRotation,
                width: isHovered ? hoverImageSize.width : teaserImageSize.width,
                height: isHovered ? hoverImageSize.height : teaserImageSize.height,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
                delay: index * 0.03,
              }}
              style={{
                backgroundImage: images[index] ? `url(${images[index]})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          );
        })}

        <motion.span
          className={cn(
            "absolute inset-x-0 bottom-0 h-[85%] origin-bottom rounded-[4px] bg-gradient-to-b shadow-sm",
            theme.front
          )}
          animate={{
            rotateX: isHovered ? -45 : -25,
            scaleY: isHovered ? 0.8 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 25,
          }}
          style={{
            transformStyle: "preserve-3d",
          }}
        >
          <span className={cn("absolute top-1 right-1 left-1 h-px", theme.line)} />
        </motion.span>
      </motion.span>
      {text ? (
        <span className={cn("min-w-0 truncate text-sm font-medium", textClassName)}>
          {text}
        </span>
      ) : null}
    </span>
  );
}
