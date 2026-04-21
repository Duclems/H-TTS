import type { CSSProperties } from "react";
import { useI18n } from "../../context/I18nContext";

type Props = {
  speed: number;
  setSpeed: (value: number) => void;
  stability: number;
  setStability: (value: number) => void;
  similarityBoost: number;
  setSimilarityBoost: (value: number) => void;
  style: number;
  setStyle: (value: number) => void;
};

const getRangeStyle = (value: number, min: number, max: number): CSSProperties =>
  ({
    "--range-fill": `${((value - min) / (max - min)) * 100}%`
  } as CSSProperties);

export const VoiceRangeSliders = ({
  speed,
  setSpeed,
  stability,
  setStability,
  similarityBoost,
  setSimilarityBoost,
  style,
  setStyle
}: Props) => {
  const { t } = useI18n();

  return (
    <div className="reward-voice-range-grid">
      <div className="reward-voice-range-item">
        <label htmlFor="rv-speed" className="reward-voice-range-label">
          {t("rewardVoice.speed")} ({speed.toFixed(2)})
        </label>
        <input
          id="rv-speed"
          type="range"
          min={0.7}
          max={1.2}
          step={0.01}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="reward-voice-range"
          style={getRangeStyle(speed, 0.7, 1.2)}
        />
      </div>
      <div className="reward-voice-range-item">
        <label htmlFor="rv-stability" className="reward-voice-range-label">
          {t("rewardVoice.stability")} ({(stability * 100).toFixed(0)}%)
        </label>
        <input
          id="rv-stability"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={stability}
          onChange={(e) => setStability(parseFloat(e.target.value))}
          className="reward-voice-range"
          style={getRangeStyle(stability, 0, 1)}
        />
      </div>
      <div className="reward-voice-range-item">
        <label htmlFor="rv-similarity" className="reward-voice-range-label">
          {t("rewardVoice.similarity")} ({(similarityBoost * 100).toFixed(0)}%)
        </label>
        <input
          id="rv-similarity"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={similarityBoost}
          onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
          className="reward-voice-range"
          style={getRangeStyle(similarityBoost, 0, 1)}
        />
      </div>
      <div className="reward-voice-range-item">
        <label htmlFor="rv-style" className="reward-voice-range-label">
          {t("rewardVoice.style")} ({(style * 100).toFixed(0)}%)
        </label>
        <input
          id="rv-style"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={style}
          onChange={(e) => setStyle(parseFloat(e.target.value))}
          className="reward-voice-range"
          style={getRangeStyle(style, 0, 1)}
        />
      </div>
    </div>
  );
};
