from __future__ import annotations

import json
import zipfile
from pathlib import Path

import pandas as pd


FORECAST_SOURCE = Path(r"C:\Users\georg\AppData\Local\Temp\Rainfall.xlsx")
RAINFALL_HISTORY_SOURCE = Path(r"C:\Users\georg\AppData\Local\Temp\Wind Speed.xlsx")
WIND_HISTORY_SOURCE = Path(r"C:\Users\georg\AppData\Local\Temp\Temperature.xlsx")
TEMPERATURE_HISTORY_SOURCE = Path(r"C:\Users\georg\Downloads\Temperature (1).xlsx")
LAMEROO_RAINFALL_SOURCE = Path(r"C:\Users\georg\Downloads\IDCJAC0009_025562_1800.zip")
WORKSPACE = Path(r"C:\Users\georg\Documents\Codex\2026-04-21-files-mentioned-by-the-user-week")

FORECAST_JSON_OUTPUT = WORKSPACE / "forecast-data.json"
FORECAST_JS_OUTPUT = WORKSPACE / "forecast-data.js"
HISTORICAL_JSON_OUTPUT = WORKSPACE / "historical-data.json"
HISTORICAL_JS_OUTPUT = WORKSPACE / "historical-data.js"


def read_summary() -> list[dict]:
    sheet = pd.read_excel(FORECAST_SOURCE, sheet_name="Summary", header=None)
    sheet = sheet.iloc[3:].copy()
    sheet.columns = ["sheetName", "stationNumber", "stationName", "state", "availableMetrics"]
    records = []

    for item in sheet.to_dict(orient="records"):
        sheet_name = item.get("sheetName")
        if not isinstance(sheet_name, str):
            continue

        records.append(
            {
                "sheetName": sheet_name,
                "stationNumber": int(item["stationNumber"]),
                "stationName": str(item["stationName"]),
                "state": str(item["state"]),
                "availableMetrics": [
                    metric.strip()
                    for metric in str(item["availableMetrics"]).split(",")
                    if metric.strip()
                ],
            }
        )

    return records


def find_column(columns: list[str], starts_with: str) -> str:
    for column in columns:
        if str(column).startswith(starts_with):
            return str(column)
    raise KeyError(f"Missing column starting with: {starts_with}")


def read_station_forecast(sheet_name: str) -> dict:
    frame = pd.read_excel(FORECAST_SOURCE, sheet_name=sheet_name, header=3)
    frame["Date"] = pd.to_datetime(frame["Date"])

    max_temp_column = find_column(list(frame.columns), "Forecast Max Temp")
    min_temp_column = find_column(list(frame.columns), "Forecast Min Temp")
    rainfall_column = find_column(list(frame.columns), "Forecast Rainfall")
    wind_speed_column = find_column(list(frame.columns), "Forecast Wind Speed")

    series = []
    for row in frame.to_dict(orient="records"):
        series.append(
            {
                "date": row["Date"].strftime("%Y-%m-%d"),
                "day": row["Day"],
                "maxTemp": round(float(row.get(max_temp_column, 0.0)), 2),
                "minTemp": round(float(row.get(min_temp_column, 0.0)), 2),
                "rainfall": round(float(row.get(rainfall_column, 0.0)), 2),
                "windSpeed": round(float(row.get(wind_speed_column, 0.0)), 2),
            }
        )

    return {
        "series": series,
        "stats": {
            "maxTemp": {
                "min": round(float(frame[max_temp_column].min()), 2),
                "max": round(float(frame[max_temp_column].max()), 2),
                "avg": round(float(frame[max_temp_column].mean()), 2),
            },
            "minTemp": {
                "min": round(float(frame[min_temp_column].min()), 2),
                "max": round(float(frame[min_temp_column].max()), 2),
                "avg": round(float(frame[min_temp_column].mean()), 2),
            },
            "rainfall": {
                "min": round(float(frame[rainfall_column].min()), 2),
                "max": round(float(frame[rainfall_column].max()), 2),
                "avg": round(float(frame[rainfall_column].mean()), 2),
                "total": round(float(frame[rainfall_column].sum()), 2),
            },
            "windSpeed": {
                "min": round(float(frame[wind_speed_column].min()), 2),
                "max": round(float(frame[wind_speed_column].max()), 2),
                "avg": round(float(frame[wind_speed_column].mean()), 2),
            },
        },
    }


def build_forecast_payload(summary_records: list[dict]) -> dict:
    stations = {}
    for station in summary_records:
        stations[str(station["stationNumber"])] = {
            **station,
            **read_station_forecast(station["sheetName"]),
        }

    return {
        "title": "2026 Daily Weather Forecasts by Station (Holt-Winters)",
        "stations": stations,
    }


def build_historical_payload(summary_records: list[dict]) -> dict:
    station_lookup = {
        station["stationNumber"]: {
            "stationName": station["stationName"],
            "state": station["state"],
        }
        for station in summary_records
    }

    rainfall = pd.read_excel(RAINFALL_HISTORY_SOURCE)
    rainfall["Rainfall amount (millimetres)"] = pd.to_numeric(
        rainfall["Rainfall amount (millimetres)"], errors="coerce"
    )
    rainfall_grouped = (
        rainfall.groupby(["Station Number", "Year", "Month"], dropna=False)["Rainfall amount (millimetres)"]
        .sum()
        .reset_index()
    )

    if LAMEROO_RAINFALL_SOURCE.exists():
        with zipfile.ZipFile(LAMEROO_RAINFALL_SOURCE) as archive:
            csv_name = next(name for name in archive.namelist() if name.endswith("_Data.csv"))
            with archive.open(csv_name) as csv_file:
                lameroo = pd.read_csv(csv_file)

        lameroo["Rainfall amount (millimetres)"] = pd.to_numeric(
            lameroo["Rainfall amount (millimetres)"], errors="coerce"
        )
        lameroo = lameroo[(lameroo["Year"] >= 2021) & (lameroo["Year"] <= 2025)].copy()
        lameroo_grouped = (
            lameroo.groupby(["Year", "Month"], dropna=False)["Rainfall amount (millimetres)"]
            .sum()
            .reset_index()
        )
        lameroo_grouped["Station Number"] = 25509

        rainfall_grouped = rainfall_grouped[rainfall_grouped["Station Number"] != 25509]
        rainfall_grouped = pd.concat(
            [
                rainfall_grouped,
                lameroo_grouped[["Station Number", "Year", "Month", "Rainfall amount (millimetres)"]],
            ],
            ignore_index=True,
        )

    wind_frames = []
    for sheet_name in ["WA", "NSW", "SA", "VIC", "QLD", "TAS"]:
        frame = pd.read_excel(WIND_HISTORY_SOURCE, sheet_name=sheet_name)
        frame["Date"] = pd.to_datetime(frame["Date"])
        frame["Wind Speed (km/h)"] = pd.to_numeric(frame["Wind Speed (km/h)"], errors="coerce")
        wind_frames.append(frame[["Station Number", "Date", "Wind Speed (km/h)"]])

    wind = pd.concat(wind_frames, ignore_index=True)
    wind["Year"] = wind["Date"].dt.year
    wind["Month"] = wind["Date"].dt.month
    wind_grouped = (
        wind.groupby(["Station Number", "Year", "Month"], dropna=False)["Wind Speed (km/h)"]
        .mean()
        .reset_index()
    )

    max_temp = pd.read_excel(TEMPERATURE_HISTORY_SOURCE, sheet_name="Max Temp")
    max_temp["Maximum temperature (Degree C)"] = pd.to_numeric(
        max_temp["Maximum temperature (Degree C)"], errors="coerce"
    )
    max_temp_grouped = (
        max_temp.groupby(["Bureau of Meteorology station number", "Year", "Month"], dropna=False)["Maximum temperature (Degree C)"]
        .mean()
        .reset_index()
    )

    min_temp = pd.read_excel(TEMPERATURE_HISTORY_SOURCE, sheet_name="Min Temp")
    min_temp["Minimum temperature (Degree C)"] = pd.to_numeric(
        min_temp["Minimum temperature (Degree C)"], errors="coerce"
    )
    min_temp_grouped = (
        min_temp.groupby(["Bureau of Meteorology station number", "Year", "Month"], dropna=False)["Minimum temperature (Degree C)"]
        .mean()
        .reset_index()
    )

    stations = {}
    for station_number, meta in station_lookup.items():
        rainfall_rows = rainfall_grouped[rainfall_grouped["Station Number"] == station_number]
        wind_rows = wind_grouped[wind_grouped["Station Number"] == station_number]
        max_temp_rows = max_temp_grouped[max_temp_grouped["Bureau of Meteorology station number"] == station_number]
        min_temp_rows = min_temp_grouped[min_temp_grouped["Bureau of Meteorology station number"] == station_number]

        stations[str(station_number)] = {
            "stationNumber": station_number,
            "stationName": meta["stationName"],
            "state": meta["state"],
            "rainfall": [
                {
                    "year": int(row["Year"]),
                    "month": int(row["Month"]),
                    "period": f"{int(row['Year']):04d}-{int(row['Month']):02d}",
                    "value": round(float(row["Rainfall amount (millimetres)"]), 2),
                }
                for _, row in rainfall_rows.iterrows()
            ],
            "windSpeed": [
                {
                    "year": int(row["Year"]),
                    "month": int(row["Month"]),
                    "period": f"{int(row['Year']):04d}-{int(row['Month']):02d}",
                    "value": round(float(row["Wind Speed (km/h)"]), 2),
                }
                for _, row in wind_rows.iterrows()
            ],
            "maxTemp": [
                {
                    "year": int(row["Year"]),
                    "month": int(row["Month"]),
                    "period": f"{int(row['Year']):04d}-{int(row['Month']):02d}",
                    "value": round(float(row["Maximum temperature (Degree C)"]), 2),
                }
                for _, row in max_temp_rows.iterrows()
            ],
            "minTemp": [
                {
                    "year": int(row["Year"]),
                    "month": int(row["Month"]),
                    "period": f"{int(row['Year']):04d}-{int(row['Month']):02d}",
                    "value": round(float(row["Minimum temperature (Degree C)"]), 2),
                }
                for _, row in min_temp_rows.iterrows()
            ],
        }

    rainfall_periods = sorted({f"{int(row['Year']):04d}-{int(row['Month']):02d}" for _, row in rainfall_grouped.iterrows()})
    wind_periods = sorted({f"{int(row['Year']):04d}-{int(row['Month']):02d}" for _, row in wind_grouped.iterrows()})
    max_temp_periods = sorted({f"{int(row['Year']):04d}-{int(row['Month']):02d}" for _, row in max_temp_grouped.iterrows()})
    min_temp_periods = sorted({f"{int(row['Year']):04d}-{int(row['Month']):02d}" for _, row in min_temp_grouped.iterrows()})

    return {
        "title": "Historical station comparison data",
        "availableMetrics": {
            "rainfall": {
                "label": "Monthly Rainfall",
                "unit": "mm",
                "years": sorted({int(value) for value in rainfall_grouped["Year"].tolist()}),
                "periods": rainfall_periods,
            },
            "windSpeed": {
                "label": "Monthly Wind Speed",
                "unit": "km/h",
                "years": sorted({int(value) for value in wind_grouped["Year"].tolist()}),
                "periods": wind_periods,
            },
            "maxTemp": {
                "label": "Monthly Max Temperature",
                "unit": "°C",
                "years": sorted({int(value) for value in max_temp_grouped["Year"].tolist()}),
                "periods": max_temp_periods,
            },
            "minTemp": {
                "label": "Monthly Min Temperature",
                "unit": "°C",
                "years": sorted({int(value) for value in min_temp_grouped["Year"].tolist()}),
                "periods": min_temp_periods,
            },
        },
        "stations": stations,
    }


def write_js_payload(path: Path, variable_name: str, payload: dict) -> None:
    serialized = json.dumps(payload, indent=2)
    path.write_text(f"window.{variable_name} = {serialized};\n", encoding="utf-8")


def main() -> None:
    summary_records = read_summary()

    forecast_payload = build_forecast_payload(summary_records)
    historical_payload = build_historical_payload(summary_records)

    FORECAST_JSON_OUTPUT.write_text(json.dumps(forecast_payload, indent=2), encoding="utf-8")
    HISTORICAL_JSON_OUTPUT.write_text(json.dumps(historical_payload, indent=2), encoding="utf-8")
    write_js_payload(FORECAST_JS_OUTPUT, "FORECAST_DATA", forecast_payload)
    write_js_payload(HISTORICAL_JS_OUTPUT, "HISTORICAL_DATA", historical_payload)


if __name__ == "__main__":
    main()
