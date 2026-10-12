import { Card, CardDescription, CardTitle } from '../ui/Card'
import { useI18n } from '../i18n'

export function PhasePlaceholder({ phase, module }: { phase: string; module: string }) {
  const { t } = useI18n()
  return (
    <Card>
      <CardTitle>{module}</CardTitle>
      <CardDescription className="mt-2">
        {t('phase.title')} â€” {t('phase.body', { phase })}
      </CardDescription>
    </Card>
  )
}
