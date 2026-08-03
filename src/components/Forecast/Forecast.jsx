import "./Forecast.css";
import { forecast } from "../../../shared/combat.js";
import { UNIT_TYPES } from "../../../shared/units.js";

const hitClass = (h) =>
  h >= 85 ? "forecast-good" : h >= 60 ? "forecast-mid" : "forecast-bad";

const HealthBar = ({ unit, loss, side }) => {
  const max = UNIT_TYPES[unit.type].maxHp;
  const pct = (unit.hp / max) * 100;
  const afterPct = (Math.max(0, unit.hp - loss) / max) * 100;
  const lossPct = pct - afterPct;
  const lossLeft = side === "them" ? 100 - pct : afterPct;

  return (
    <div className="forecast-bar">
      <i style={{ width: `${pct}%` }} />
      {loss > 0 && (
        <u style={{ left: `${lossLeft}%`, width: `${lossPct}%` }} />
      )}
    </div>
  );
};

const Side = ({ unit, loss, side }) => {
  const t = UNIT_TYPES[unit.type];
  return (
    <div className={`forecast-side forecast-${side}`}>
      <div className="forecast-name">{unit.name ?? t.label}</div>
      <div className="forecast-class">{t.label}</div>
      <div className="forecast-nums">
        {side === "them" && <span className="forecast-max">{t.maxHp} /</span>}
        <span className="forecast-now">{unit.hp}</span>
        {side === "you" && <span className="forecast-max">/ {t.maxHp}</span>}
      </div>
      <HealthBar unit={unit} loss={loss} side={side} />
    </div>
  );
};

/**
 * Shown when a target is picked, before the attack is committed.
 * Reads the same combat module the server resolves with, so the numbers here
 * are the numbers that will happen.
 */
const Forecast = ({ attacker, defender, attackerTile, defenderTile }) => {
  if (!attacker || !defender) return null;

  const f = forecast(attacker, defender, { attackerTile, defenderTile });
  if (!f.inRange) return null;

  const themAfter = Math.max(0, defender.hp - f.defenderMaxLoss);
  const youAfter = Math.max(0, attacker.hp - f.attackerMaxLoss);

  const verdict =
    themAfter === 0
      ? ["forecast-good", "Lethal if it connects"]
      : youAfter === 0
        ? ["forecast-bad", "You die on the counter"]
        : f.hit < 65
          ? ["forecast-mid", "Low odds"]
          : ["", "Even trade"];

  return (
    <div className="forecast">
      <div className="forecast-heads">
        <Side unit={attacker} loss={f.attackerMaxLoss} side="you" />
        <div className="forecast-vs">VS</div>
        <Side unit={defender} loss={f.defenderMaxLoss} side="them" />
      </div>

      <div className="forecast-rule" />

      <div className="forecast-stats">
        <div className="forecast-cell forecast-stripe">
          {f.damage}
          {f.effective && <span className="forecast-eff">EFF</span>}
          {f.doubles && <span className="forecast-dbl">×2</span>}
        </div>
        <div className="forecast-key forecast-stripe">Damage</div>
        <div className="forecast-cell forecast-them forecast-stripe">
          {f.canCounter ? (
            <>
              {f.counterDoubles && <span className="forecast-dbl">×2</span>}
              {f.counterEffective && <span className="forecast-eff">EFF</span>}
              {f.counterDamage}
            </>
          ) : (
            <span className="forecast-none">—</span>
          )}
        </div>

        <div className={`forecast-cell ${hitClass(f.hit)}`}>{f.hit}%</div>
        <div className="forecast-key">Hit</div>
        <div
          className={`forecast-cell forecast-them ${
            f.canCounter ? hitClass(f.counterHit) : "forecast-none"
          }`}
        >
          {f.canCounter ? `${f.counterHit}%` : "—"}
        </div>

        <div className="forecast-cell forecast-stripe">{f.crit}%</div>
        <div className="forecast-key forecast-stripe">Crit</div>
        <div
          className={`forecast-cell forecast-them forecast-stripe ${
            f.canCounter ? "" : "forecast-none"
          }`}
        >
          {f.canCounter ? `${f.counterCrit}%` : "—"}
        </div>
      </div>

      <div className="forecast-rule" />

      <div className="forecast-verdict">
        <span className={verdict[0]}>
          <b>{verdict[1]}</b>
        </span>
        <span>
          {f.effective
            ? `Effective vs ${UNIT_TYPES[defender.type].label.toLowerCase()}`
            : f.canCounter
              ? `Counters at range ${UNIT_TYPES[defender.type].range}`
              : "No counter (out of range)"}
        </span>
      </div>
    </div>
  );
};

export default Forecast;
