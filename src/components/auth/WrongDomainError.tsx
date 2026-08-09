export function WrongDomainError({ message, targetUrl }: { message: string; targetUrl: string }) {
  return (
    <p className="text-destructive text-center text-sm" role="alert">
      {message}{' '}
      <a href={targetUrl} className="font-semibold underline underline-offset-2">
        Go there now
      </a>
    </p>
  )
}
