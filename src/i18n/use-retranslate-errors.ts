import { useEffect, useRef } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

/**
 * A form keeps its errors as the text written when it validated. When the language changes, this validates again the
 * fields showing an error so it is written in the new language.
 */
export function useRetranslateErrors<Values extends FieldValues, Context, Output>(
  form: UseFormReturn<Values, Context, Output>,
) {
  const language = useTranslation().i18n.resolvedLanguage
  const previous = useRef(language)

  useEffect(() => {
    if (previous.current === language) {
      return
    }
    previous.current = language
    // Only a new attempt can bring back an error from the API
    form.clearErrors('root')
    const fields = Object.keys(form.formState.errors).filter((field) => field !== 'root')
    if (fields.length > 0) {
      void form.trigger(fields as Path<Values>[])
    }
  }, [language, form])
}
