import type { CSSProperties } from "react";
import { Chip } from "../atoms/Chip";

export type ChipItem = {
  label: string;
  danger?: boolean;
};

type Props = {
  chips: ChipItem[];
  style?: CSSProperties;
};

export const TokenChipRow = ({ chips, style }: Props) => {
  return (
    <div className="token-chip-row" style={style}>
      {chips.map((chip, index) => (
        <Chip key={`${chip.label}-${index}`} danger={chip.danger}>
          {chip.label}
        </Chip>
      ))}
    </div>
  );
};
