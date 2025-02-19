import * as core from '@actions/core'

/* Validate a possible object i.e., o = { "a": 2 } */
export const isJSONObject = (o: Record<string, any>): boolean =>
  !!o && (typeof o === 'object') && !Array.isArray(o) &&
  ((): boolean => { try { return Boolean(JSON.stringify(o)) } catch { return false } })()

/* Validate a possible JSON object represented as string i.e., s = '{ "a": 3 }' */
export const isJSONObjectString = (s: string): boolean => {
  try {
    const o = JSON.parse(s)
    return !!o && (typeof o === 'object') && !Array.isArray(o)
  } catch {
    return false
  }
}

// Code Explanation:
// - !!o - Not falsy (excludes null, which registers as typeof 'object')
// - (typeof o === 'object') - Excludes boolean, number, and string
// - !Array.isArray(o) - Exclude arrays (which register as typeof 'object')
// - try ... JSON.stringify / JSON.parse - Asks JavaScript engine to determine if valid JSON


export const flattenJSONObject = (data: Record<string, any>): Record<string, any> => {
  if (!isJSONObject(data)) {
    throw TypeError('Cannot flatten non JSON arguments')
  }
  const result = {}
  function recurse(cur, prop): void {
    if (Object(cur) !== cur) {
      result[prop] = cur
    } else if (Array.isArray(cur)) {
      const l = cur.length
      for (let i = 0; i < l; i++)
        recurse(cur[i], prop + '[' + i + ']')
      if (l === 0)
        result[prop] = []
    } else {
      let isEmpty = true
      for (const p in cur) {
        isEmpty = false
        recurse(cur[p], prop ? prop + '_' + p : p)
      }
      if (isEmpty && prop)
        result[prop] = {}
    }
  }
  recurse(data, '')
  return result
}

export const filterBy = (items: Array<string>, filter: string): Array<string> => {
  return items.filter(item => new RegExp('^' + filter.replace(/\*/g, '.*') + '$').test(item))
}

export const getPOSIXString = (data: string): string => {
  if (data.match(/^[0-9]/))
    data = '_'.concat(data)
  return data.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()
}

export const injectSecretValueMapToEnvironment = (
  secretValueMap: Record<string, any>,
  shouldSuppressPOSIXWarning: boolean,
  shouldAddToStepsENV: boolean,
  shouldAddToStepOutput: boolean,
  maskSecrets: boolean
): void => {
  for (const secretName in secretValueMap) {
    const secretValue: string = secretValueMap[secretName]
    if (maskSecrets) {
      core.setSecret(secretValue)
    }
    // If secretName contains non-posix characters, it can't be read by the shell
    // Get POSIX compliant name secondary env name that can be read by the shell
    const secretNamePOSIX = getPOSIXString(secretName)
    if (secretName !== secretNamePOSIX && !shouldSuppressPOSIXWarning) {
      core.warning('One of the secrets has a name that is not POSIX compliant and hence cannot directly \
be used/injected as an environment variable name. Therefore, it will be transformed into a POSIX compliant \
environment variable name. Enable GitHub Actions Debug Logging \
(https://docs.github.com/en/free-pro-team@latest/actions/managing-workflow-runs/enabling-debug-logging) to \
see the transformed environment variable name.\nPOSIX compliance: environment variable names can only contain \
upper case letters, digits and underscores. It cannot begin with a digit.')
      core.debug(`Secret name '${secretName}' is not POSIX compliant. It will be transformed to '${secretNamePOSIX}'.`)
    }
    if (shouldAddToStepsENV) {
      core.debug(`Injecting environment variable '${secretNamePOSIX}'.`)
      core.exportVariable(secretNamePOSIX, secretValue)
    }

    if (shouldAddToStepOutput) {
      core.debug(`Adding variable '${secretNamePOSIX}' to the step output.`)
      core.setOutput(secretNamePOSIX, secretValue)
    }
  }
}
