import {extractSampleDataFromSuggestOutput, sampleDataVersion} from "./sample-data.js";

import {expect, it} from "vitest";

const sampleSuggest = `magento/module-bundle suggests:
 - magento/module-bundle-sample-data: Sample Data version: 100.4.*

magento/module-catalog suggests:
 - magento/module-catalog-sample-data: Sample Data version: 100.4.*

magento/module-catalog-rule suggests:
 - magento/module-catalog-rule-sample-data: Sample Data version: 100.4.*

magento/module-cms suggests:
 - magento/module-cms-sample-data: Sample Data version: 100.4.*

magento/module-configurable-product suggests:
 - magento/module-configurable-sample-data: Sample Data version: 100.4.*
 - magento/module-product-links-sample-data: Sample Data version: 100.4.*

magento/module-customer suggests:
 - magento/module-customer-sample-data: Sample Data version: 100.4.*

magento/module-downloadable suggests:
 - magento/module-downloadable-sample-data: Sample Data version: 100.4.*

magento/module-grouped-product suggests:
 - magento/module-grouped-product-sample-data: Sample Data version: 100.4.*

magento/module-msrp suggests:
 - magento/module-msrp-sample-data: Sample Data version: 100.4.*

magento/module-offline-shipping suggests:
 - magento/module-offline-shipping-sample-data: Sample Data version: 100.4.*

magento/module-review suggests:
 - magento/module-review-sample-data: Sample Data version: 100.4.*

magento/module-sales suggests:
 - magento/module-sales-sample-data: Sample Data version: 100.4.*

magento/module-sales-rule suggests:
 - magento/module-sales-rule-sample-data: Sample Data version: 100.4.*

magento/module-sample-data suggests:
 - magento/sample-data-media: Sample Data version: 100.4.*

magento/module-swatches suggests:
 - magento/module-swatches-sample-data: Sample Data version: 100.4.*

magento/module-tax suggests:
 - magento/module-tax-sample-data: Sample Data version: 100.4.*

magento/module-theme suggests:
 - magento/module-theme-sample-data: Sample Data version: 100.4.*

magento/module-widget suggests:
 - magento/module-widget-sample-data: Sample Data version: 100.4.*

magento/module-wishlist suggests:
 - magento/module-wishlist-sample-data: Sample Data version: 100.4.*
 
 
 
`.split('\n');

it('returns patch version of sample data if suggested version satisfies it', () => {
    expect(sampleDataVersion('2.4.7-p10', '100.4.*')).toBe('100.4.3');
});

it('returns patch version of sample data if suggested version satisfies it', () => {
    expect(sampleDataVersion('2.4.6-beta1', '100.3.*')).toBe('100.3.*');
});


it('returns suggested version if no default version available', () => {
    expect(sampleDataVersion('2.0.0-beta1', '500.3.*')).toBe('500.3.*');
});

it('extracts suggested sample data from suggest output', () => {
    expect(extractSampleDataFromSuggestOutput(sampleSuggest, '2.4.7-p1')).toEqual({
        "magento/module-bundle-sample-data": "100.4.3",
        "magento/module-catalog-rule-sample-data": "100.4.3",
        "magento/module-catalog-sample-data": "100.4.3",
        "magento/module-cms-sample-data": "100.4.3",
        "magento/module-configurable-sample-data": "100.4.3",
        "magento/module-customer-sample-data": "100.4.3",
        "magento/module-downloadable-sample-data": "100.4.3",
        "magento/module-grouped-product-sample-data": "100.4.3",
        "magento/module-msrp-sample-data": "100.4.3",
        "magento/module-offline-shipping-sample-data": "100.4.3",
        "magento/module-product-links-sample-data": "100.4.3",
        "magento/module-review-sample-data": "100.4.3",
        "magento/module-sales-rule-sample-data": "100.4.3",
        "magento/module-sales-sample-data": "100.4.3",
        "magento/module-swatches-sample-data": "100.4.3",
        "magento/module-tax-sample-data": "100.4.3",
        "magento/module-theme-sample-data": "100.4.3",
        "magento/module-widget-sample-data": "100.4.3",
        "magento/module-wishlist-sample-data": "100.4.3",
        "magento/sample-data-media": "100.4.*",
    });

    expect(extractSampleDataFromSuggestOutput(sampleSuggest, '2.4.8')).toEqual({
        "magento/module-bundle-sample-data": "100.4.4",
        "magento/module-catalog-rule-sample-data": "100.4.4",
        "magento/module-catalog-sample-data": "100.4.4",
        "magento/module-cms-sample-data": "100.4.4",
        "magento/module-configurable-sample-data": "100.4.4",
        "magento/module-customer-sample-data": "100.4.4",
        "magento/module-downloadable-sample-data": "100.4.4",
        "magento/module-grouped-product-sample-data": "100.4.4",
        "magento/module-msrp-sample-data": "100.4.4",
        "magento/module-offline-shipping-sample-data": "100.4.4",
        "magento/module-product-links-sample-data": "100.4.4",
        "magento/module-review-sample-data": "100.4.4",
        "magento/module-sales-rule-sample-data": "100.4.4",
        "magento/module-sales-sample-data": "100.4.4",
        "magento/module-swatches-sample-data": "100.4.4",
        "magento/module-tax-sample-data": "100.4.4",
        "magento/module-theme-sample-data": "100.4.4",
        "magento/module-widget-sample-data": "100.4.4",
        "magento/module-wishlist-sample-data": "100.4.4",
        "magento/sample-data-media": "100.4.*",
    });
});