// The state of an AI draft: a formula that cannot be drawn, or the second, blind answer matched the key, differed, or
// is missing.
export function AiBadge({ verification, broken }: { verification: string; broken?: boolean }) {
  return broken ? (
    <span className="badge bad">AI draft · formula broken, fix before use</span>
  ) : verification === 'dual_solve_agree' ? (
    <span className="badge warn">AI draft · answers match</span>
  ) : (
    <span className="badge bad">
      AI draft · {verification === 'dual_solve_disagree' ? 'answers differ, fix before use' : 'not checked, check it'}
    </span>
  );
}
