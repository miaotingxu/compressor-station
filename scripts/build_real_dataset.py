#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 9 个真实数据文件，预处理为前端可直接消费的精简数据集。

输入：仓库根目录下的数据包
  - 设备运行参数.csv / 设备状态监测.csv / 用气负荷数据.csv
  - 环境参数.xlsx / 管网运行数据.xlsx / 维护保养记录.xlsx / 运行事件记录.xlsx
  - 设备档案.json / 指标释义.json

输出：src/data/generated/realDataset.json
  - meta / devices / daily / hourly / realtime / forecast / metrics / quality / events / maint

单位约定：
  - 原始压力为 MPa，脚本统一换算为 bar (×10)，与程序既有字段 pressureBar 对齐
  - 系统比功率 specificEnergy 单位 kWh/m³

运行：python3 scripts/build_real_dataset.py
依赖：pandas, openpyxl
"""
import json
import os
import tempfile
import zipfile
from datetime import datetime

import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "data", "generated", "realDataset.json")

RATED_FLOW = 268.9          # 单机额定气量 m3/min
RATED_TOTAL = 537.8         # 站点额定总流量 m3/min
RATED_PRESSURE_MPA = 0.66   # 额定排气压力
RATED_POWER = 1250          # 单机额定功率 kW
RATED_SP = 4.65             # 额定比功率 kW/(m3/min)


def read_xlsx(path: str) -> pd.DataFrame:
    """读取反斜杠打包的 xlsx：把条目名规范化为正斜杠后重新打包。"""
    tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
    tmp.close()
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zout:
        for it in zin.infolist():
            zout.writestr(it.filename.replace("\\", "/"), zin.read(it.filename))
    df = pd.read_excel(tmp.name)
    os.unlink(tmp.name)
    return df


def load_all() -> dict:
    return {
        "op": pd.read_csv(os.path.join(ROOT, "设备运行参数.csv")),
        "st": pd.read_csv(os.path.join(ROOT, "设备状态监测.csv")),
        "load": pd.read_csv(os.path.join(ROOT, "用气负荷数据.csv")),
        "env": read_xlsx(os.path.join(ROOT, "环境参数.xlsx")),
        "net": read_xlsx(os.path.join(ROOT, "管网运行数据.xlsx")),
        "maint": read_xlsx(os.path.join(ROOT, "维护保养记录.xlsx")),
        "evt": read_xlsx(os.path.join(ROOT, "运行事件记录.xlsx")),
        "archive": json.load(open(os.path.join(ROOT, "设备档案.json"), encoding="utf-8"))["设备档案"],
    }


def r(x, n=2):
    if x is None or (isinstance(x, float) and (np.isnan(x) or np.isinf(x))):
        return None
    return round(float(x), n)


def main():
    d = load_all()
    op, st, load, net = d["op"], d["st"], d["load"], d["net"]
    env, maint, evt, archive = d["env"], d["maint"], d["evt"], d["archive"]

    for df in (op, st, load, net, env, maint, evt):
        df["time"] = pd.to_datetime(df["time"])

    start, end = op["time"].iloc[0], op["time"].iloc[-1]
    rows = len(op)

    # ---------- 站点压力合格带（母管压力） ----------
    hp = net["母管压力"] * 10.0  # MPa -> bar
    lo = float(np.floor(hp.quantile(0.05) * 10) / 10)
    hi = float(np.ceil(hp.quantile(0.99) * 10) / 10)
    band = [r(lo, 1), r(hi, 1)]

    # ---------- 设备档案 ----------
    devices = []
    maint_last = maint.iloc[-1]
    for dev in archive:
        pre = f"{dev['编号']}#"
        idle = pre + "状态"
        running = (evt[idle] == 8).mean() * 100
        v1 = st[pre + "一级震动"].replace(0, np.nan)
        v2 = st[pre + "二级震动"].replace(0, np.nan)
        v3 = st[pre + "三级震动"].replace(0, np.nan)
        # 取三级转子中最高的均值，反映最不利转子
        vib = np.nanmax([v1.mean(), v2.mean(), v3.mean()])
        bd = np.nanmean([st[pre + "电机轴承D端温度"].replace(0, np.nan).mean(),
                         st[pre + "电机轴承ND端温度"].replace(0, np.nan).mean()])
        wd = np.nanmean([st[pre + "电机线圈1U1温度"].replace(0, np.nan).mean(),
                         st[pre + "电机线圈1V1温度"].replace(0, np.nan).mean(),
                         st[pre + "电机线圈1W1温度"].replace(0, np.nan).mean()])
        cur = np.nanmean([op[pre + "A相电流"].replace(0, np.nan).mean(),
                          op[pre + "C相电流"].replace(0, np.nan).mean()])
        tail = op[op[pre + "实时流量"] > 0].tail(1440)
        pressure = float(tail[pre + "排气压力"].mean()) * 10
        flow = float(tail[pre + "实时流量"].mean())
        power = float(tail[pre + "功率"].mean())
        igv = float(tail[pre + "IGV开度"].mean())
        bov = float(tail[pre + "BOV闭度"].mean())
        oil = float(tail[pre + "变速箱油压"].mean()) * 10
        run_h = maint_last[pre + "总运行时间"]
        next_h = maint_last[pre + "下次保养剩余时间"]
        # 清洗明显异常值（4# 总运行时间 uint16 溢出、保养剩余时间溢出）
        run_h = None if (pd.notna(run_h) and run_h > 50000) else r(run_h, 1)
        next_h = None if (pd.notna(next_h) and next_h > 100000) else r(next_h, 1)

        # 健康分：以振动/绕组温度/排气温度为主的经验罚分
        score = 100 - max(0, (vib - 4.5)) * 3 - max(0, (wd - 65)) * 0.8 - max(0, (np.nanmean(st[pre + "排气温度"].replace(0, np.nan)) - 92)) * 0.6
        score = int(max(55, min(98, round(score))))
        surge = "medium" if bov < 20 else "low" if bov < 50 else "none"

        devices.append({
            "id": f"AC-{dev['编号']:02d}",
            "name": f"{dev['编号']}# 离心式空压机",
            "kind": "centrifugal",
            "brand": dev["品牌"],
            "model": dev["型号"],
            "code": dev["设备码"],
            "ratedPowerKw": dev["额定功率_kW"],
            "ratedFlowM3Min": dev["额定气量_m3min"],
            "ratedPressureBar": r(dev["额定压力_MPa"] * 10, 2),
            "ratedSpecificPower": dev["比功率_kW_m3min"],
            "status": "running" if evt[idle].iloc[-1] == 8 else "standby",
            "loadRate": int(round(flow / RATED_FLOW * 100)),
            "pressureBar": r(pressure, 2),
            "flowM3Min": r(flow, 1),
            "powerKw": int(round(power)),
            "igvPct": r(igv, 1),
            "bovPct": r(bov, 1),
            "healthScore": score,
            "surgeRisk": surge,
            "runningHours": run_h,
            "installedAt": dev["出厂日期"],
            "nextMaintenanceDueHours": next_h,
            "vibration": r(vib, 2),
            "bearingTempC": r(bd, 1),
            "windingTempC": r(wd, 1),
            "exhaustTempC": r(np.nanmean(st[pre + "排气温度"].replace(0, np.nan)), 1),
            "exhaustTempPeakC": r(st[pre + "排气温度"].max(), 1),
            "currentA": r(cur, 1),
            "oilPressureBar": r(oil, 2),
            "runRatePct": r(running, 1),
            # 控制网关可靠性：由该机组数据完整性推导（保养剩余时间溢出视为数据链路异常）
            "gatewayReliable": bool(np.nanmax(maint[pre + "下次保养剩余时间"]) <= 100000),
            "maintenancePlan": dev["保养计划"],
        })

    # ---------- 分钟级合并 ----------
    m = pd.DataFrame({"time": op["time"]})
    m["power"] = op["4#功率"] + op["5#功率"]
    m["flow4"] = op["4#实时流量"]
    m["flow5"] = op["5#实时流量"]
    m["airflow"] = load["总流量"]
    m["loadRate"] = load["负荷率"]
    m["level"] = load["负荷等级"]
    m["headerBar"] = (net["母管压力"] * 10.0).values
    m["run4"] = (evt["4#状态"] == 8).astype(int).values
    m["run5"] = (evt["5#状态"] == 8).astype(int).values
    m["run"] = ((m["run4"] == 1) | (m["run5"] == 1)).astype(int)
    m["qualify"] = (m["headerBar"] >= band[0]) & (m["headerBar"] <= band[1])
    m["lowLoad"] = (m["loadRate"] < 0.5).astype(int)
    m["date"] = m["time"].dt.strftime("%Y-%m-%d")

    # ---------- 日汇总（全量 6 个月） ----------
    g = m.groupby("date")
    daily = pd.DataFrame({
        "date": list(g.groups.keys()),
        "powerKwh": g["power"].sum() / 60.0,          # kW 分钟 -> kWh
        "airflowM3": g["airflow"].sum(),               # 1 分钟均值 -> m3
        "pressureQualifyPct": g["qualify"].mean() * 100,
        "avgLoadRatePct": g["loadRate"].mean() * 100,
        "lowLoadHours": g["lowLoad"].sum() / 60.0,
        "runRatePct": g["run"].mean() * 100,
    }).reset_index(drop=True)
    daily["specificEnergy"] = daily["powerKwh"] / daily["airflowM3"]
    dev_by_date = m.assign(_dv=(m["loadRate"] - 0.8).abs() * 100).groupby("date")["_dv"].mean()
    daily["avgLoadDeviationPct"] = daily["date"].map(dev_by_date)

    mid = start + (end - start) / 2
    daily["mode"] = np.where(pd.to_datetime(daily["date"]) < mid, "baseline", "current")
    daily_json = [{
        "date": row["date"],
        "powerKwh": int(round(row["powerKwh"])),
        "airflowKm3": r(row["airflowM3"] / 1000, 1),
        "specificEnergy": r(row["specificEnergy"], 4),
        "pressureQualifyPct": r(row["pressureQualifyPct"], 2),
        "avgLoadRatePct": r(row["avgLoadRatePct"], 1),
        "avgLoadDeviationPct": r(row["avgLoadDeviationPct"], 1),
        "lowLoadHours": r(row["lowLoadHours"], 1),
        "runRatePct": r(row["runRatePct"], 1),
        "mode": row["mode"],
    } for _, row in daily.iterrows()]

    # ---------- 小时级（最近 30 天） ----------
    h = m[m["time"] >= end - pd.Timedelta(days=30)].copy()
    h["h"] = h["time"].dt.floor("h")
    hg = h.groupby("h")
    hourly_json = [{
        "time": str(k),
        "demandM3Min": r(v["airflow"].mean(), 1),
        "totalPowerKw": int(round(v["power"].mean())),
        "headerPressureBar": r(v["headerBar"].mean(), 2),
        "specificEnergy": r(v["power"].mean() / max(v["airflow"].mean() * 60, 1), 4),
        "qualify": bool(v["qualify"].mean() >= 0.5),
    } for k, v in hg]

    # ---------- 实时趋势（末尾 6 小时，分钟级） ----------
    rt = m[m["time"] >= end - pd.Timedelta(hours=6)]
    realtime_json = [{
        "time": t.strftime("%H:%M"),
        "pressureBar": r(hb, 2),
        "totalFlow": r(af, 0),
        "totalPowerKw": int(round(pw)),
        "avgLoadRate": r(lr * 100, 1),
    } for t, hb, af, pw, lr in zip(rt["time"], rt["headerBar"], rt["airflow"], rt["power"], rt["loadRate"])]

    # ---------- 未来 4 小时负荷预测（基于最近一日同时段形态） ----------
    last_day = m[m["time"] >= end - pd.Timedelta(days=1)].copy()
    last_day["hh"] = last_day["time"].dt.hour
    shape = last_day.groupby("hh")["airflow"].mean()
    rnd = np.random.default_rng(20260912)
    forecast_json = []
    for i in range(1, 17):
        t = end + pd.Timedelta(minutes=15 * i)
        base = float(shape.get(t.hour, shape.mean()))
        v = base * (0.99 + rnd.random() * 0.02)
        forecast_json.append({
            "time": t.strftime("%H:%M"),
            "forecastM3Min": r(v, 0),
            "upper": r(v * 1.05, 0),
            "lower": r(v * 0.95, 0),
        })

    # ---------- 全周期设备级小时序列（支撑历史回放） ----------
    dm = pd.DataFrame({"time": op["time"]})
    for num in (4, 5):
        pre = f"{num}#"
        dm[f"{pre}loadRate"] = op[f"{pre}实时流量"] / RATED_FLOW * 100
        dm[f"{pre}pressureBar"] = op[f"{pre}排气压力"] * 10
        dm[f"{pre}flow"] = op[f"{pre}实时流量"]
        dm[f"{pre}power"] = op[f"{pre}功率"]
        dm[f"{pre}current"] = (op[f"{pre}A相电流"] + op[f"{pre}C相电流"]) / 2
        dm[f"{pre}vib"] = st[[f"{pre}一级震动", f"{pre}二级震动", f"{pre}三级震动"]].mean(axis=1)
        dm[f"{pre}winding"] = st[[f"{pre}电机线圈1U1温度", f"{pre}电机线圈1V1温度", f"{pre}电机线圈1W1温度"]].mean(axis=1)
        dm[f"{pre}bearing"] = st[[f"{pre}电机轴承D端温度", f"{pre}电机轴承ND端温度"]].mean(axis=1)
        dm[f"{pre}oil"] = op[f"{pre}变速箱油压"] * 10
        dm[f"{pre}run"] = (evt[f"{num}#状态"] == 8).astype(int).values
    dm["h"] = dm["time"].dt.floor("h")
    m["h"] = m["time"].dt.floor("h")
    dg = dm.groupby("h")
    mg = m.groupby("h")
    series_times = [str(k) for k in dg.groups.keys()]
    dev_series = {}
    for num in (4, 5):
        pre = f"{num}#"
        dev_series[f"AC-{num:02d}"] = {
            "loadRate": [r(v, 1) for v in dg[f"{pre}loadRate"].mean()],
            "pressureBar": [r(v, 2) for v in dg[f"{pre}pressureBar"].mean()],
            "flowM3Min": [r(v, 1) for v in dg[f"{pre}flow"].mean()],
            "powerKw": [int(round(v)) for v in dg[f"{pre}power"].mean()],
            "currentA": [r(v, 1) for v in dg[f"{pre}current"].mean()],
            "vibration": [r(v, 2) for v in dg[f"{pre}vib"].mean()],
            "windingTempC": [r(v, 1) for v in dg[f"{pre}winding"].mean()],
            "bearingTempC": [r(v, 1) for v in dg[f"{pre}bearing"].mean()],
            "oilPressureBar": [r(v, 2) for v in dg[f"{pre}oil"].mean()],
            "running": [int(round(v)) for v in dg[f"{pre}run"].mean()],
        }
    station_series = {
        "headerPressureBar": [r(v, 2) for v in mg["headerBar"].mean()],
        "totalFlow": [r(v, 1) for v in mg["airflow"].mean()],
        "totalPowerKw": [int(round(v)) for v in mg["power"].mean()],
        "avgLoadRate": [r((a + b) / 2, 1) for a, b in zip(dg["4#loadRate"].mean(), dg["5#loadRate"].mean())],
    }
    series = {"times": series_times, "devices": dev_series, "station": station_series}

    # ---------- 基线 / 近期指标 ----------
    def agg(sub):
        return {
            "specificEnergy": r(sub["specificEnergy"].mean(), 4),
            "pressureQualifyPct": r(sub["pressureQualifyPct"].mean(), 2),
            "loadDeviationPct": r(sub["avgLoadDeviationPct"].mean(), 1),
            "lowLoadHours": r(sub["lowLoadHours"].mean(), 1),
            "avgLoadRatePct": r(sub["avgLoadRatePct"].mean(), 1),
            "runRatePct": r(sub["runRatePct"].mean(), 1),
        }

    m["mode"] = np.where(m["time"] < mid, "baseline", "current")
    pstd = m.groupby("mode")["headerBar"].std()
    base = daily[daily["mode"] == "baseline"]
    cur = daily[daily["mode"] == "current"]
    metrics = {
        "baseline": agg(base),
        "current": agg(cur),
        "pressureStd": {
            "baseline": r(pstd.get("baseline"), 3),
            "current": r(pstd.get("current"), 3),
        },
        "loadLevelDist": {
            "low": int((load["负荷等级"] == 0).sum()),
            "mid": int((load["负荷等级"] == 1).sum()),
            "high": int((load["负荷等级"] == 2).sum()),
        },
    }

    # ---------- 数据质量 ----------
    quality = []
    if (op["4#B相电流"].abs().max() == 0) and (op["5#B相电流"].abs().max() == 0):
        quality.append({"source": "设备运行参数.csv", "metric": "B相电流", "type": "field_invalid",
                        "severity": "critical", "detail": "4#/5# B 相电流全程恒为 0，电流数据仅 A/C 相有效，三相不平衡与过流保护无法核验。"})
    if evt["4#加卸载"].isna().all() and evt["5#加卸载"].isna().all():
        quality.append({"source": "运行事件记录.xlsx", "metric": "加卸载", "type": "field_missing",
                        "severity": "warning", "detail": "4#/5# 加卸载状态字段全程为空，无法还原机组加/卸载时序。"})
    if (evt["4#预警"].abs().sum() == 0) and (evt["5#预警"].abs().sum() == 0):
        quality.append({"source": "运行事件记录.xlsx", "metric": "预警", "type": "no_data",
                        "severity": "warning", "detail": "预警字段全程为 0，可能与预警未接入或字段未映射有关。"})
    if maint["4#下次保养剩余时间"].max() > 1e6:
        quality.append({"source": "维护保养记录.xlsx", "metric": "4#下次保养剩余时间", "type": "outlier",
                        "severity": "critical", "detail": "4# 下次保养剩余时间出现 4.29e9 级异常值，字段疑似单位/溢出错误，已截断处理。"})
    if maint["4#总运行时间"].max() > 50000:
        quality.append({"source": "维护保养记录.xlsx", "metric": "4#总运行时间", "type": "outlier",
                        "severity": "warning", "detail": "4# 总运行时间出现 65535（2^16-1）上限值，疑似 uint16 溢出。"})
    if (op["4#空气过滤器压降"] < 0).mean() > 0.5:
        quality.append({"source": "设备运行参数.csv", "metric": "空气过滤器压降", "type": "outlier",
                        "severity": "warning", "detail": "4#/5# 空气过滤器压降过半为负值，量程或取压方向存疑。"})
    neg_level = int((load["负荷率"] > 1).sum())
    if neg_level:
        quality.append({"source": "用气负荷数据.csv", "metric": "负荷率", "type": "outlier",
                        "severity": "warning", "detail": f"负荷率有 {neg_level} 条记录超过 100%（最高 111%），与额定总流量 537.8 m³/min 口径不一致。"})

    # ---------- 全量测点统计与应用文件清单（让真实数据尽可能可见） ----------
    file_map = [
        ("设备运行参数", op, "设备运行参数.csv", "CSV"),
        ("设备状态监测", st, "设备状态监测.csv", "CSV"),
        ("用气负荷数据", load, "用气负荷数据.csv", "CSV"),
        ("环境参数", env, "环境参数.xlsx", "XLSX"),
        ("管网运行数据", net, "管网运行数据.xlsx", "XLSX"),
        ("维护保养记录", maint, "维护保养记录.xlsx", "XLSX"),
        ("运行事件记录", evt, "运行事件记录.xlsx", "XLSX"),
    ]
    # 源数据为 MPa 的压力类字段，统一换算为 bar
    pressure_fields = {"4#排气压力", "5#排气压力", "母管压力", "4#变速箱油压", "5#变速箱油压"}
    points = []
    assets = []
    for name, df, fname, kind in file_map:
        cols = [c for c in df.columns if c != "time"]
        assets.append({
            "file": fname, "kind": kind, "group": name, "rows": int(len(df)), "fields": len(cols),
            "rangeStart": str(df["time"].iloc[0]), "rangeEnd": str(df["time"].iloc[-1]),
        })
        for c in cols:
            raw = pd.to_numeric(df[c], errors="coerce")
            scale = 10.0 if c in pressure_fields else 1.0
            s = raw * scale
            dev = "AC-04" if c.startswith("4#") else "AC-05" if c.startswith("5#") else ""
            valid = int(s.notna().sum())
            points.append({
                "file": fname, "column": c, "group": name, "device": dev,
                "unit": "bar" if c in pressure_fields else "",
                "min": r(s.min(), 2) if valid else None,
                "mean": r(s.mean(), 2) if valid else None,
                "max": r(s.max(), 2) if valid else None,
                "latest": r(s.iloc[-1], 2) if pd.notna(s.iloc[-1]) else None,
                "coveragePct": r(valid / len(s) * 100, 1),
            })

    # ---------- 事件（状态跳变片段） ----------
    events = []
    for num in (4, 5):
        s = (evt[f"{num}#状态"] == 8).astype(int)
        ch = s.diff().fillna(0)
        for t, delta in zip(evt["time"][ch != 0], ch[ch != 0]):
            events.append({"time": str(t), "device": f"AC-{num:02d}", "to": "running" if delta > 0 else "stop"})

    # ---------- 保养快照 ----------
    maint_json = []
    for num in (4, 5):
        run_h = maint_last[f"{num}#总运行时间"]
        load_h = maint_last[f"{num}#总负载时间"]
        nxt = maint_last[f"{num}#下次保养剩余时间"]
        maint_json.append({
            "device": f"AC-{num:02d}",
            "totalRunHours": None if run_h > 50000 else r(run_h, 1),
            "totalLoadHours": None if load_h > 50000 else r(load_h, 1),
            "nextMaintenanceDueHours": None if nxt > 100000 else r(nxt, 1),
        })

    dataset = {
        "meta": {
            "source": "真实数据包（9 文件）",
            "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "rangeStart": str(start),
            "rangeEnd": str(end),
            "rows": int(rows),
            "ratedTotalFlow": RATED_TOTAL,
            "ratedFlowPerUnit": RATED_FLOW,
            "ratedPressureBar": r(RATED_PRESSURE_MPA * 10, 2),
            "ratedPower": RATED_POWER,
            "ratedSpecificPower": RATED_SP,
            "pressureBandBar": band,
            "midpoint": str(mid),
        },
        "devices": devices,
        "daily": daily_json,
        "hourly": hourly_json,
        "realtime": realtime_json,
        "forecast": forecast_json,
        "metrics": metrics,
        "quality": quality,
        "events": events[:500],
        "maint": maint_json,
        "series": series,
        "points": points,
        "assets": assets,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, separators=(",", ":"))
    # 同步一份到 public/data，供运行时替换（无需重新构建）
    pub = os.path.join(ROOT, "public", "data", "realDataset.json")
    os.makedirs(os.path.dirname(pub), exist_ok=True)
    with open(pub, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, separators=(",", ":"))
    print("written:", OUT, os.path.getsize(OUT), "bytes")
    print("runtime copy:", pub, os.path.getsize(pub), "bytes")
    print("range:", start, "~", end, "rows:", rows)
    print("band(bar):", band)
    print("devices:", [(x["id"], x["status"], x["loadRate"], x["healthScore"], x["surgeRisk"]) for x in devices])
    print("metrics:", json.dumps(metrics, ensure_ascii=False))
    print("quality issues:", len(quality), "events:", len(dataset["events"]))


if __name__ == "__main__":
    main()
