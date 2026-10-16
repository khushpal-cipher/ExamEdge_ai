// The state of an AI draft: the second, blind answer matched the key, differed, or is missing.
export function AiBadge({ verification }: { verification: string }) {
  return verification === 'dual_solve_agree' ? (
    <span className="badge warn">AI draft · answers match</span>
  ) : (
    <span className="badge bad">
      AI draft · {verification === 'dual_solve_disagree' ? 'answers differ, fix before use' : 'not checked, check it'}
    </span>
  );
}
