import { getState, saveState } from '@actions/core'
import { run as runMain } from './main'
import { run as runPost } from './post'

if (getState('build-init') === 'true') {
    runPost()
} else {
    saveState('build-init', 'true')
    runMain()
}
