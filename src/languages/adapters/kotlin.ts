import {defineAdapter,text} from '../adapter.js';
import {jvmCommands} from './java.js';
export const kotlin=defineAdapter({id:'kotlin',matches:f=>f==='build.gradle.kts'||f==='pom.xml',tools:['java'],requirements:r=>[text(r,'build.gradle.kts').match(/jvmToolchain\((\d+)\)/)?.[1]??'Project-supported Kotlin/JVM toolchain'],commands:r=>jvmCommands(r,'kotlin')});
