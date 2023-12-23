// TODO: もっと良いモジュール名を考える

// TODO: ダンジョン壁用に適切なangleおよびfudgeFactorを四点から計算する手順を確立する(難しい)

const a=10, b=11, c=12, d=13, e=14, f=15;

// TODO: 32にするか64にするかは後で決める
//const typedArrayClass = Float64Array;
const typedArrayClass = Float32Array;

const identityMatrix = new typedArrayClass([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

export const mat4clone = (m) => new typedArrayClass(m);

export const mat4make = () => mat4clone(identityMatrix);

export const mat4overwrite = (to, from) => (to.set(from), to);

export const mat4reset = (m) => m.set(identityMatrix);

export const mat4compose = (m1, m2, result=m1) => {
  const m1_0 = m1[0], m1_1 = m1[1], m1_2 = m1[2], m1_3 = m1[3],
        m1_4 = m1[4], m1_5 = m1[5], m1_6 = m1[6], m1_7 = m1[7],
        m1_8 = m1[8], m1_9 = m1[9], m1_a = m1[a], m1_b = m1[b],
        m1_c = m1[c], m1_d = m1[d], m1_e = m1[e], m1_f = m1[f];
  const m2_0 = m2[0], m2_1 = m2[1], m2_2 = m2[2], m2_3 = m2[3],
        m2_4 = m2[4], m2_5 = m2[5], m2_6 = m2[6], m2_7 = m2[7],
        m2_8 = m2[8], m2_9 = m2[9], m2_a = m2[a], m2_b = m2[b],
        m2_c = m2[c], m2_d = m2[d], m2_e = m2[e], m2_f = m2[f];
  result[0] = m1_0*m2_0 + m1_4*m2_1 + m1_8*m2_2 + m1_c*m2_3;
  result[1] = m1_1*m2_0 + m1_5*m2_1 + m1_9*m2_2 + m1_d*m2_3;
  result[2] = m1_2*m2_0 + m1_6*m2_1 + m1_a*m2_2 + m1_e*m2_3;
  result[3] = m1_3*m2_0 + m1_7*m2_1 + m1_b*m2_2 + m1_f*m2_3;

  result[4] = m1_0*m2_4 + m1_4*m2_5 + m1_8*m2_6 + m1_c*m2_7;
  result[5] = m1_1*m2_4 + m1_5*m2_5 + m1_9*m2_6 + m1_d*m2_7;
  result[6] = m1_2*m2_4 + m1_6*m2_5 + m1_a*m2_6 + m1_e*m2_7;
  result[7] = m1_3*m2_4 + m1_7*m2_5 + m1_b*m2_6 + m1_f*m2_7;

  result[8] = m1_0*m2_8 + m1_4*m2_9 + m1_8*m2_a + m1_c*m2_b;
  result[9] = m1_1*m2_8 + m1_5*m2_9 + m1_9*m2_a + m1_d*m2_b;
  result[a] = m1_2*m2_8 + m1_6*m2_9 + m1_a*m2_a + m1_e*m2_b;
  result[b] = m1_3*m2_8 + m1_7*m2_9 + m1_b*m2_a + m1_f*m2_b;

  result[c] = m1_0*m2_c + m1_4*m2_d + m1_8*m2_e + m1_c*m2_f;
  result[d] = m1_1*m2_c + m1_5*m2_d + m1_9*m2_e + m1_d*m2_f;
  result[e] = m1_2*m2_c + m1_6*m2_d + m1_a*m2_e + m1_e*m2_f;
  result[f] = m1_3*m2_c + m1_7*m2_d + m1_b*m2_e + m1_f*m2_f;
  return result;
};

export const mat4composeR = (m1, m2, result=m1) => mat4compose(m2, m1, result);

export const mat4move = (m, x=0, y=0, z=0) => {
  m[c] += x*m[0] + y*m[4] + z*m[8];
  m[d] += x*m[1] + y*m[5] + z*m[9];
  m[e] += x*m[2] + y*m[6] + z*m[a];
  m[f] += x*m[3] + y*m[7] + z*m[b];
  return m;
};

export const mat4scale = (m, x=1, y=1, z=1) => {
  m[0] *= x;
  m[1] *= x;
  m[2] *= x;
  m[3] *= x;
  m[4] *= y;
  m[5] *= y;
  m[6] *= y;
  m[7] *= y;
  m[8] *= z;
  m[9] *= z;
  m[a] *= z;
  m[b] *= z;
  return m;
};

export const mat4rotate = (m, angle, axisX, axisY, axisZ) => {
  const sq = Math.sqrt(axisX*axisX + axisY*axisY + axisZ*axisZ);
  if (!sq) { return m }
  if (sq != 1){
    const isq = 1/sq;
    axisX *= isq;
    axisY *= isq;
    axisZ *= isq;
  }
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const cosR = 1 - cos;
  const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3],
        m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7],
        m8 = m[8], m9 = m[9], ma = m[a], mb = m[b];
  const r00 = axisX*axisX*cosR + cos;
  const r01 = axisY*axisX*cosR + axisZ*sin;
  const r02 = axisZ*axisX*cosR - axisY*sin;

  const r10 = axisX*axisY*cosR - axisZ*sin;
  const r11 = axisY*axisY*cosR + cos;
  const r12 = axisZ*axisY*cosR + axisX*sin;

  const r20 = axisX*axisZ*cosR + axisY*sin;
  const r21 = axisY*axisZ*cosR - axisX*sin;
  const r22 = axisZ*axisZ*cosR + cos;
  m[0] = m0*r00 + m4*r01 + m8*r02;
  m[1] = m1*r00 + m5*r01 + m9*r02;
  m[2] = m2*r00 + m6*r01 + ma*r02;
  m[3] = m3*r00 + m7*r01 + mb*r02;
  m[4] = m0*r10 + m4*r11 + m8*r12;
  m[5] = m1*r10 + m5*r11 + m9*r12;
  m[6] = m2*r10 + m6*r11 + ma*r12;
  m[7] = m3*r10 + m7*r11 + mb*r12;
  m[8] = m0*r20 + m4*r21 + m8*r22;
  m[9] = m1*r20 + m5*r21 + m9*r22;
  m[a] = m2*r20 + m6*r21 + ma*r22;
  m[b] = m3*r20 + m7*r21 + mb*r22;
  return m;
};

export const mat4invert = (m) => {
  const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3],
        m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7],
        m8 = m[8], m9 = m[9], ma = m[a], mb = m[b],
        mc = m[c], md = m[d], me = m[e], mf = m[f];
  const s0514 = m0*m5 - m1*m4, s0624 = m0*m6 - m2*m4,
        s0734 = m0*m7 - m3*m4, s1625 = m1*m6 - m2*m5,
        s1735 = m1*m7 - m3*m5, s2736 = m2*m7 - m3*m6;
  const s8d9c = m8*md - m9*mc, s8eac = m8*me - ma*mc,
        s8fbc = m8*mf - mb*mc, s9ead = m9*me - ma*md,
        s9fbd = m9*mf - mb*md, safbe = ma*mf - mb*me;
  const ivd = 1/(s0514*safbe - s0624*s9fbd + s0734*s9ead + s1625*s8fbc - s1735*s8eac + s2736*s8d9c);
  m[0] = ( m5*safbe - m6*s9fbd + m7*s9ead)*ivd;
  m[1] = (-m1*safbe + m2*s9fbd - m3*s9ead)*ivd;
  m[2] = ( md*s2736 - me*s1735 + mf*s1625)*ivd;
  m[3] = (-m9*s2736 + ma*s1735 - mb*s1625)*ivd;
  m[4] = (-m4*safbe + m6*s8fbc - m7*s8eac)*ivd;
  m[5] = ( m0*safbe - m2*s8fbc + m3*s8eac)*ivd;
  m[6] = (-mc*s2736 + me*s0734 - mf*s0624)*ivd;
  m[7] = ( m8*s2736 - ma*s0734 + mb*s0624)*ivd;
  m[8] = ( m4*s9fbd - m5*s8fbc + m7*s8d9c)*ivd;
  m[9] = (-m0*s9fbd + m1*s8fbc - m3*s8d9c)*ivd;
  m[a] = ( mc*s1735 - md*s0734 + mf*s0514)*ivd;
  m[b] = (-m8*s1735 + m9*s0734 - mb*s0514)*ivd;
  m[c] = (-m4*s9ead + m5*s8eac - m6*s8d9c)*ivd;
  m[d] = ( m0*s9ead - m1*s8eac + m2*s8d9c)*ivd;
  m[e] = (-mc*s1625 + md*s0624 - me*s0514)*ivd;
  m[f] = ( m8*s1625 - m9*s0624 + ma*s0514)*ivd;
  return m;
};

export const mat4transpose = (m) => {
  const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3],
        m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7],
        m8 = m[8], m9 = m[9], ma = m[a], mb = m[b],
        mc = m[c], md = m[d], me = m[e], mf = m[f];
  //m[0] = m0;
  m[1] = m4;
  m[2] = m8;
  m[3] = mc;
  m[4] = m1;
  //m[5] = m5;
  m[6] = m9;
  m[7] = md;
  m[8] = m2;
  m[9] = m6;
  //m[a] = ma;
  m[b] = me;
  m[c] = m3;
  m[d] = m7;
  m[e] = mb;
  //m[f] = mf;
  return m;
};

export const mat4setFudgeFactor = (m, fudgeFactor) => (m[b] = fudgeFactor, m);
