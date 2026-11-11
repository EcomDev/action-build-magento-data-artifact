import {run} from "./main.js";
import {setFailed}  from '@actions/core';

run().catch((error) => setFailed(error.message));