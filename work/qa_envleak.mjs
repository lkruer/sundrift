// QA: does every environment rebuild (rig.setTime with env) leak its PMREM render target? Textures counted by three,
// and the GPU process's own memory from Windows' GPU counters, before and after N rebuilds.
import { execSync } from 'child_process';
import { open, sleep } from './qa_lib.mjs';

const N = Number(process.argv[2] || 60);
const Q = await open({ out: 'work/qa_out/envleak' });
const { ev, note, browser } = Q;
const bpid = browser.process().pid;
const gpuPid = () => {
  const out = execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ParentProcessId=${bpid}' | Where-Object { $_.CommandLine -like '*--type=gpu-process*' } | Select-Object -ExpandProperty ProcessId"`).toString().trim();
  return Number(out.split(/\s+/)[0]);
};
const gpuMem = (pid) => {
  const out = execSync(`powershell -NoProfile -Command "$c = Get-Counter -ErrorAction SilentlyContinue -Counter '\\GPU Process Memory(pid_${pid}_*)\\Dedicated Usage','\\GPU Process Memory(pid_${pid}_*)\\Shared Usage'; $d = 0; $s = 0; foreach ($x in $c.CounterSamples) { if ($x.Path -like '*dedicated usage') { $d += $x.CookedValue } else { $s += $x.CookedValue } }; [math]::Round($d/1MB,1).ToString() + ' ' + [math]::Round($s/1MB,1).ToString()"`).toString().trim();
  const [d, s] = out.split(' ').map(Number);
  return { dedicatedMB: d, sharedMB: s };
};
const pid = gpuPid();
note('gpu pid', pid);
const tex = () => ev('window.__DEBUG__.renderer.info.memory.textures');
await sleep(3000);
note('before', { textures: await tex(), ...gpuMem(pid) });
for (let k = 0; k < N; k++) {
  await ev(`window.__DEBUG__.rig.setTime({ hour: ${(6 + k * 0.1).toFixed(2)} }, { env: true })`);
  await sleep(60);
}
await sleep(2000);
note(`after ${N} env rebuilds`, { textures: await tex(), ...gpuMem(pid) });
await Q.close();
